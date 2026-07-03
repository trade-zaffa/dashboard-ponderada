from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from database import get_connection
from routers.metas import get_db, _check_admin

router = APIRouter()

BUS = ['LMP_CASA', 'AL_NUT', 'LMP_CUPE', 'HGPER_BB']
META_CRESCIMENTO = 1.15  # +15% sobre o ano anterior

# ── Tabela de execução (PE + planograma) ───────────────────────────────────────

def _init_programa_tables():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS programa_execucao (
            cnpj_raiz   TEXT    NOT NULL,
            mes         INTEGER NOT NULL,
            ano         INTEGER NOT NULL,
            ponto_extra INTEGER NOT NULL DEFAULT 0,
            planograma  INTEGER NOT NULL DEFAULT 0,
            UNIQUE(cnpj_raiz, mes, ano)
        )
    """)
    conn.commit()
    conn.close()

_init_programa_tables()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _sortimento_faixa(pct: float) -> float:
    if pct >= 92:
        return 0.50
    if pct >= 70:
        return 0.25
    return 0.0


def _sql_faturado(ph: str) -> str:
    return f"""
        SELECT s.cd_secao,
               SUM(CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) <= 0 THEN 0
                    ELSE in2.vl_tot_liquido * (in2.qtde - ISNULL(in2.qtde_dev,0)) / NULLIF(in2.qtde,0)
                    END) AS vl_faturado
        FROM ped_vda pv
        JOIN nota n      ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
        JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
        JOIN produto p   ON p.cd_prod = in2.cd_prod
        JOIN linha l     ON l.cd_linha = p.cd_linha
        JOIN secao s     ON s.cd_secao = l.cd_secao
        WHERE pv.cd_clien IN ({ph})
          AND LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
          AND n.situacao IN ('AB','DP') AND n.tipo_nf = 'S'
          AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
          AND p.cd_fabric = 'UNILEV'
          AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
          AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
          AND MONTH(n.dt_emis) = ? AND YEAR(n.dt_emis) = ?
        GROUP BY s.cd_secao
    """


# ── Endpoint cliente ───────────────────────────────────────────────────────────

@router.get("/programa")
def get_programa(
    cd_cliens: str = Query(...),
    cnpj_raiz: str = Query(...),
    mes: int = Query(...),
    ano: int = Query(...),
):
    ids = [int(x.strip()) for x in cd_cliens.split(",")]
    ph = ",".join("?" * len(ids))
    n_lojas = len(ids)
    ano_anterior = ano - 1

    # ── 1. SQLite: execução e meta de EANs ────────────────────────────────────
    db = get_db()
    execucao = db.execute(
        "SELECT ponto_extra, planograma FROM programa_execucao WHERE cnpj_raiz=? AND mes=? AND ano=?",
        (cnpj_raiz, mes, ano),
    ).fetchone()
    meta_eans_map = {
        r["cd_secao"]: r["meta_eans"]
        for r in db.execute(
            "SELECT cd_secao, meta_eans FROM ponderada_meta WHERE mes=? AND ano=?",
            (mes, ano),
        ).fetchall()
    }
    db.close()

    ponto_extra = bool(execucao["ponto_extra"]) if execucao else False
    planograma  = bool(execucao["planograma"])  if execucao else False

    sql_fat  = _sql_faturado(ph)
    sql_sort = f"""
        WITH base AS (
            SELECT DISTINCT p.cd_prod, s.cd_secao
            FROM produto p
            JOIN linha l ON l.cd_linha = p.cd_linha
            JOIN secao s ON s.cd_secao = l.cd_secao
            JOIN estoque e ON e.cd_prod = p.cd_prod AND e.cd_local = 'CENTRAL'
            WHERE p.cd_fabric = 'UNILEV'
              AND p.ativo = 1
              AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
              AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
              AND (e.qtde - ISNULL(e.qtde_pend_pedv,0)) > 0
        ),
        vendas AS (
            SELECT in2.cd_prod,
                   SUM(CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) > 0
                            THEN (in2.qtde - ISNULL(in2.qtde_dev,0)) * in2.fator_est_vda
                            ELSE 0 END) AS unidades
            FROM ped_vda pv
            JOIN nota n      ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
            JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
            WHERE pv.cd_clien IN ({ph})
              AND LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
              AND n.situacao IN ('AB','DP') AND n.tipo_nf = 'S'
              AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
              AND MONTH(n.dt_emis) = ? AND YEAR(n.dt_emis) = ?
            GROUP BY in2.cd_prod
        )
        SELECT b.cd_secao,
               COUNT(DISTINCT b.cd_prod) AS total_eans,
               COUNT(DISTINCT CASE WHEN v.unidades >= {n_lojas} * 3 THEN b.cd_prod END) AS positivado
        FROM base b
        LEFT JOIN vendas v ON v.cd_prod = b.cd_prod
        GROUP BY b.cd_secao
    """

    try:
        conn = get_connection()
        cur  = conn.cursor()

        # Faturamento mês atual
        cur.execute(sql_fat, ids + [mes, ano])
        fat_map = {r.cd_secao.strip(): float(r.vl_faturado or 0) for r in cur.fetchall()}

        # Faturamento mesmo mês ano anterior → meta (+15%)
        cur.execute(sql_fat, ids + [mes, ano_anterior])
        meta_fat_map = {
            r.cd_secao.strip(): float(r.vl_faturado or 0) * META_CRESCIMENTO
            for r in cur.fetchall()
        }

        # Sortimento
        cur.execute(sql_sort, ids + [mes, ano])
        sort_map = {
            r.cd_secao.strip(): {"total": r.total_eans, "positivado": r.positivado}
            for r in cur.fetchall()
        }
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── 3. Montar resultado por BU ─────────────────────────────────────────────
    resultado = []
    total_ganho    = 0.0
    total_potencial = 0.0

    for bu in BUS:
        meta_fat  = meta_fat_map.get(bu, 0.0)
        meta_eans = meta_eans_map.get(bu, 0)
        fat_atual = fat_map.get(bu, 0.0)
        sort_data = sort_map.get(bu, {"total": 0, "positivado": 0})

        # Sortimento
        sort_pos  = sort_data["positivado"]
        sort_pct  = (sort_pos / meta_eans * 100) if meta_eans > 0 else 0.0
        sort_peso = _sortimento_faixa(sort_pct)

        # Faturamento proporcional (cap 100%)
        fat_pct  = min(100.0, (fat_atual / meta_fat * 100) if meta_fat > 0 else 0.0)
        fat_peso = fat_pct / 100 * 1.0

        # PE e Planograma
        pe_peso   = 0.50 if ponto_extra else 0.0
        plan_peso = 0.50 if planograma  else 0.0

        total_peso   = sort_peso + pe_peso + plan_peso + fat_peso
        ganho_bu     = meta_fat * total_peso / 100
        potencial_bu = meta_fat * 2.50 / 100

        total_ganho     += ganho_bu
        total_potencial += potencial_bu

        # Faturamento ano anterior (base da meta, sem o +15%)
        fat_ano_ant = meta_fat / META_CRESCIMENTO if meta_fat > 0 else 0.0

        resultado.append({
            "cd_secao":        bu,
            "meta_fat":        round(meta_fat, 2),
            "fat_ano_anterior": round(fat_ano_ant, 2),
            "meta_eans":       meta_eans,
            "sort_positivado": sort_pos,
            "sort_total":      sort_data["total"],
            "sort_pct":        round(sort_pct, 1),
            "sort_peso":       sort_peso,
            "fat_atual":       round(fat_atual, 2),
            "fat_pct":         round(fat_pct, 1),
            "fat_peso":        round(fat_peso, 4),
            "ponto_extra":     ponto_extra,
            "planograma":      planograma,
            "pe_peso":         pe_peso,
            "plan_peso":       plan_peso,
            "total_peso":      round(total_peso, 4),
            "ganho_bu":        round(ganho_bu, 2),
            "potencial_bu":    round(potencial_bu, 2),
        })

    return {
        "mes": mes,
        "ano": ano,
        "ano_anterior": ano_anterior,
        "crescimento_pct": int((META_CRESCIMENTO - 1) * 100),
        "ponto_extra": ponto_extra,
        "planograma":  planograma,
        "bus": resultado,
        "total_ganho":     round(total_ganho, 2),
        "total_potencial": round(total_potencial, 2),
    }


# ── Endpoints Admin ────────────────────────────────────────────────────────────

class ExecucaoInput(BaseModel):
    cnpj_raiz:   str
    mes:         int
    ano:         int
    ponto_extra: bool
    planograma:  bool


@router.get("/admin/programa-execucao")
def get_programa_execucao(
    authorization: str = Header(None),
    mes: int = Query(...),
    ano: int = Query(...),
):
    _check_admin(authorization)
    db = get_db()
    rows = db.execute(
        "SELECT cnpj_raiz, ponto_extra, planograma FROM programa_execucao WHERE mes=? AND ano=?",
        (mes, ano),
    ).fetchall()
    db.close()
    return {
        r["cnpj_raiz"]: {
            "ponto_extra": bool(r["ponto_extra"]),
            "planograma":  bool(r["planograma"]),
        }
        for r in rows
    }


@router.get("/admin/programa-resumo")
def get_programa_resumo(
    authorization: str = Header(None),
    mes: int = Query(...),
    ano: int = Query(...),
):
    """Resumo do programa para TODOS os clientes ponderada — visão admin."""
    _check_admin(authorization)
    ano_anterior = ano - 1

    # ── 1. Execuções e meta_eans do SQLite ────────────────────────────────────
    db = get_db()
    exec_rows = db.execute(
        "SELECT cnpj_raiz, ponto_extra, planograma FROM programa_execucao WHERE mes=? AND ano=?",
        (mes, ano),
    ).fetchall()
    execucao_map = {
        r["cnpj_raiz"]: {"ponto_extra": bool(r["ponto_extra"]), "planograma": bool(r["planograma"])}
        for r in exec_rows
    }
    meta_eans_map = {
        r["cd_secao"]: r["meta_eans"]
        for r in db.execute(
            "SELECT cd_secao, meta_eans FROM ponderada_meta WHERE mes=? AND ano=?",
            (mes, ano),
        ).fetchall()
    }
    db.close()

    # ── 2. Faturamento atual + anterior para todos os clientes ponderada ──────
    sql_fat_all = f"""
        SELECT
            LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8) AS cnpj_raiz,
            s.cd_secao,
            SUM(CASE WHEN YEAR(n.dt_emis) = {ano}          AND MONTH(n.dt_emis) = {mes}
                     THEN CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) <= 0 THEN 0
                          ELSE in2.vl_tot_liquido * (in2.qtde - ISNULL(in2.qtde_dev,0)) / NULLIF(in2.qtde,0) END
                     ELSE 0 END) AS fat_atual,
            SUM(CASE WHEN YEAR(n.dt_emis) = {ano_anterior} AND MONTH(n.dt_emis) = {mes}
                     THEN CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) <= 0 THEN 0
                          ELSE in2.vl_tot_liquido * (in2.qtde - ISNULL(in2.qtde_dev,0)) / NULLIF(in2.qtde,0) END
                     ELSE 0 END) AS fat_anterior
        FROM ped_vda pv
        JOIN nota n      ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
        JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
        JOIN produto p   ON p.cd_prod = in2.cd_prod
        JOIN linha l     ON l.cd_linha = p.cd_linha
        JOIN secao s     ON s.cd_secao = l.cd_secao
        JOIN cliente c   ON c.cd_clien = pv.cd_clien
        JOIN CliSegmentoFabric csf ON csf.CdClien = c.cd_clien
        WHERE csf.CdFabric = 'UNILEV'
          AND csf.RamAtiv IN ('33  ','34  ')
          AND c.ativo = 1
          AND LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
          AND n.situacao IN ('AB','DP') AND n.tipo_nf = 'S'
          AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
          AND p.cd_fabric = 'UNILEV'
          AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
          AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
          AND (
            (YEAR(n.dt_emis) = {ano}          AND MONTH(n.dt_emis) = {mes}) OR
            (YEAR(n.dt_emis) = {ano_anterior} AND MONTH(n.dt_emis) = {mes})
          )
        GROUP BY LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8), s.cd_secao
    """

    # ── 3. Sortimento positivado por cliente por BU ───────────────────────────
    sql_sort_all = f"""
        WITH base AS (
            SELECT DISTINCT p.cd_prod, s.cd_secao
            FROM produto p
            JOIN linha l ON l.cd_linha = p.cd_linha
            JOIN secao s ON s.cd_secao = l.cd_secao
            JOIN estoque e ON e.cd_prod = p.cd_prod AND e.cd_local = 'CENTRAL'
            WHERE p.cd_fabric = 'UNILEV' AND p.ativo = 1
              AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
              AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
              AND (e.qtde - ISNULL(e.qtde_pend_pedv,0)) > 0
        ),
        grupos AS (
            SELECT LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8) AS cnpj_raiz,
                   COUNT(*) AS n_lojas
            FROM cliente c
            JOIN CliSegmentoFabric csf ON csf.CdClien = c.cd_clien
            WHERE csf.CdFabric = 'UNILEV' AND csf.RamAtiv IN ('33  ','34  ') AND c.ativo = 1
            GROUP BY LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8)
        ),
        vendas AS (
            SELECT LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8) AS cnpj_raiz,
                   in2.cd_prod,
                   SUM(CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) > 0
                            THEN (in2.qtde - ISNULL(in2.qtde_dev,0)) * in2.fator_est_vda ELSE 0 END) AS unidades
            FROM ped_vda pv
            JOIN nota n      ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
            JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
            JOIN cliente c   ON c.cd_clien = pv.cd_clien
            JOIN CliSegmentoFabric csf ON csf.CdClien = c.cd_clien
            WHERE csf.CdFabric = 'UNILEV' AND csf.RamAtiv IN ('33  ','34  ')
              AND LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
              AND n.situacao IN ('AB','DP') AND n.tipo_nf = 'S'
              AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
              AND MONTH(n.dt_emis) = {mes} AND YEAR(n.dt_emis) = {ano}
            GROUP BY LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8), in2.cd_prod
        )
        SELECT g.cnpj_raiz, b.cd_secao,
               COUNT(DISTINCT b.cd_prod) AS total_eans,
               COUNT(DISTINCT CASE WHEN v.unidades >= g.n_lojas * 3 THEN b.cd_prod END) AS positivado
        FROM grupos g
        CROSS JOIN base b
        LEFT JOIN vendas v ON v.cnpj_raiz = g.cnpj_raiz AND v.cd_prod = b.cd_prod
        GROUP BY g.cnpj_raiz, b.cd_secao
    """

    try:
        conn = get_connection()
        cur  = conn.cursor()

        cur.execute(sql_fat_all)
        # fat_data[cnpj_raiz][bu] = {fat_atual, fat_anterior}
        fat_data = {}
        for r in cur.fetchall():
            cr = r.cnpj_raiz.strip()
            if cr not in fat_data:
                fat_data[cr] = {}
            fat_data[cr][r.cd_secao.strip()] = {
                "fat_atual":    float(r.fat_atual    or 0),
                "fat_anterior": float(r.fat_anterior or 0),
            }

        cur.execute(sql_sort_all)
        sort_data = {}
        for r in cur.fetchall():
            cr = r.cnpj_raiz.strip()
            if cr not in sort_data:
                sort_data[cr] = {}
            sort_data[cr][r.cd_secao.strip()] = {
                "total":      r.total_eans,
                "positivado": r.positivado,
            }
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── 4. Calcular ganho por cliente ─────────────────────────────────────────
    todos_cnpjs = set(fat_data.keys()) | set(sort_data.keys())
    resultado = []

    for cnpj_raiz in todos_cnpjs:
        exec_cli   = execucao_map.get(cnpj_raiz, {"ponto_extra": False, "planograma": False})
        ponto_extra = exec_cli["ponto_extra"]
        planograma  = exec_cli["planograma"]

        total_ganho     = 0.0
        total_potencial = 0.0
        total_fat_atual = 0.0
        total_meta_fat  = 0.0
        bus_detail = []

        for bu in BUS:
            fat = fat_data.get(cnpj_raiz, {}).get(bu, {"fat_atual": 0, "fat_anterior": 0})
            srt = sort_data.get(cnpj_raiz, {}).get(bu, {"total": 0, "positivado": 0})
            meta_eans = meta_eans_map.get(bu, 0)

            meta_fat  = fat["fat_anterior"] * META_CRESCIMENTO
            fat_atual = fat["fat_atual"]

            sort_pos  = srt["positivado"]
            sort_pct  = (sort_pos / meta_eans * 100) if meta_eans > 0 else 0.0
            sort_peso = _sortimento_faixa(sort_pct)

            fat_pct  = min(100.0, (fat_atual / meta_fat * 100) if meta_fat > 0 else 0.0)
            fat_peso = fat_pct / 100 * 1.0

            pe_peso   = 0.50 if ponto_extra else 0.0
            plan_peso = 0.50 if planograma  else 0.0

            total_peso   = sort_peso + pe_peso + plan_peso + fat_peso
            ganho_bu     = meta_fat * total_peso / 100
            potencial_bu = meta_fat * 2.50 / 100

            total_ganho     += ganho_bu
            total_potencial += potencial_bu
            total_fat_atual += fat_atual
            total_meta_fat  += meta_fat

            bus_detail.append({
                "cd_secao":        bu,
                "fat_atual":       round(fat_atual, 2),
                "meta_fat":        round(meta_fat, 2),
                "fat_pct":         round(fat_pct, 1),
                "sort_pct":        round(sort_pct, 1),
                "sort_positivado": srt["positivado"],
                "sort_total":      srt["total"],
                "meta_eans":       meta_eans,
                "sort_peso":       sort_peso,
                "fat_peso":        round(fat_peso, 4),
                "ganho_bu":        round(ganho_bu, 2),
            })

        fat_pct_total = min(100.0, (total_fat_atual / total_meta_fat * 100) if total_meta_fat > 0 else 0.0)

        resultado.append({
            "cnpj_raiz":      cnpj_raiz,
            "ponto_extra":    ponto_extra,
            "planograma":     planograma,
            "total_fat_atual":  round(total_fat_atual, 2),
            "total_meta_fat":   round(total_meta_fat, 2),
            "fat_pct_total":    round(fat_pct_total, 1),
            "total_ganho":      round(total_ganho, 2),
            "total_potencial":  round(total_potencial, 2),
            "ating_pct":        round((total_ganho / total_potencial * 100) if total_potencial > 0 else 0, 1),
            "bus": bus_detail,
        })

    resultado.sort(key=lambda x: x["total_ganho"], reverse=True)
    return resultado


@router.post("/admin/programa-execucao")
def set_programa_execucao(body: ExecucaoInput, authorization: str = Header(None)):
    _check_admin(authorization)
    db = get_db()
    db.execute(
        """INSERT INTO programa_execucao (cnpj_raiz, mes, ano, ponto_extra, planograma)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(cnpj_raiz, mes, ano)
           DO UPDATE SET ponto_extra=excluded.ponto_extra, planograma=excluded.planograma""",
        (body.cnpj_raiz, body.mes, body.ano, int(body.ponto_extra), int(body.planograma)),
    )
    db.commit()
    db.close()
    return {"ok": True}
