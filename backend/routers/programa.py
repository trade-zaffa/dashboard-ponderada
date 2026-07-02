from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from database import get_connection
from routers.metas import get_db, _check_admin

router = APIRouter()

BUS = ['LMP_CASA', 'AL_NUT', 'LMP_CUPE', 'HGPER_BB']

# ── Tabelas ────────────────────────────────────────────────────────────────────

def _init_programa_tables():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS programa_meta_fat (
            cd_secao TEXT    NOT NULL,
            mes      INTEGER NOT NULL,
            ano      INTEGER NOT NULL,
            meta_fat REAL    NOT NULL,
            UNIQUE(cd_secao, mes, ano)
        )
    """)
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


# ── Helpers de cálculo ─────────────────────────────────────────────────────────

def _sortimento_faixa(pct: float) -> float:
    """Retorna o % de ganho do pilar sortimento conforme faixa."""
    if pct >= 92:
        return 0.50
    if pct >= 70:
        return 0.25
    return 0.0


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

    # ── 1. Metas e execuções do SQLite ────────────────────────────────────────
    db = get_db()
    metas_fat = {
        r["cd_secao"]: r["meta_fat"]
        for r in db.execute(
            "SELECT cd_secao, meta_fat FROM programa_meta_fat WHERE mes=? AND ano=?",
            (mes, ano),
        ).fetchall()
    }
    execucao = db.execute(
        "SELECT ponto_extra, planograma FROM programa_execucao WHERE cnpj_raiz=? AND mes=? AND ano=?",
        (cnpj_raiz, mes, ano),
    ).fetchone()
    meta_eans_rows = db.execute(
        "SELECT cd_secao, meta_eans FROM ponderada_meta WHERE mes=? AND ano=?",
        (mes, ano),
    ).fetchall()
    meta_eans_map = {r["cd_secao"]: r["meta_eans"] for r in meta_eans_rows}
    db.close()

    ponto_extra = bool(execucao["ponto_extra"]) if execucao else False
    planograma  = bool(execucao["planograma"])  if execucao else False

    # ── 2. Faturamento por BU no mês (MOINHO) ─────────────────────────────────
    sql_fat = f"""
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

    # ── 3. Sortimento positivado por BU no mês (MOINHO) ───────────────────────
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

        cur.execute(sql_fat, ids + [mes, ano])
        fat_map = {r.cd_secao.strip(): float(r.vl_faturado or 0) for r in cur.fetchall()}

        cur.execute(sql_sort, ids + [mes, ano])
        sort_map = {
            r.cd_secao.strip(): {
                "total": r.total_eans,
                "positivado": r.positivado,
            }
            for r in cur.fetchall()
        }
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── 4. Montar resultado por BU ─────────────────────────────────────────────
    resultado = []
    total_ganho = 0.0
    total_potencial = 0.0

    for bu in BUS:
        meta_fat = metas_fat.get(bu, 0.0)
        meta_eans = meta_eans_map.get(bu, 0)
        fat_atual = fat_map.get(bu, 0.0)
        sort_data = sort_map.get(bu, {"total": 0, "positivado": 0})

        # Sortimento: % atingido vs meta_eans
        sort_pos = sort_data["positivado"]
        sort_pct = (sort_pos / meta_eans * 100) if meta_eans > 0 else 0.0
        sort_peso = _sortimento_faixa(sort_pct)

        # Faturamento: proporcional, cap em 100%
        fat_pct  = min(100.0, (fat_atual / meta_fat * 100) if meta_fat > 0 else 0.0)
        fat_peso = fat_pct / 100 * 1.0  # peso máximo 1.00%

        # Ponto Extra e Planograma: binário
        pe_peso   = 0.50 if ponto_extra else 0.0
        plan_peso = 0.50 if planograma  else 0.0

        total_peso   = sort_peso + pe_peso + plan_peso + fat_peso  # % total ganho
        potencial    = (0.50 + 0.50 + 0.50 + 1.00)                # % potencial máximo

        ganho_bu     = meta_fat * total_peso / 100
        potencial_bu = meta_fat * potencial  / 100

        total_ganho    += ganho_bu
        total_potencial += potencial_bu

        resultado.append({
            "cd_secao":      bu,
            "meta_fat":      meta_fat,
            "meta_eans":     meta_eans,
            # Sortimento
            "sort_positivado": sort_pos,
            "sort_total":      sort_data["total"],
            "sort_pct":        round(sort_pct, 1),
            "sort_peso":       sort_peso,
            # Faturamento
            "fat_atual":  fat_atual,
            "fat_pct":    round(fat_pct, 1),
            "fat_peso":   round(fat_peso, 4),
            # PE e Planograma
            "ponto_extra": ponto_extra,
            "planograma":  planograma,
            "pe_peso":     pe_peso,
            "plan_peso":   plan_peso,
            # Totais
            "total_peso":    round(total_peso, 4),
            "ganho_bu":      round(ganho_bu, 2),
            "potencial_bu":  round(potencial_bu, 2),
        })

    return {
        "mes": mes,
        "ano": ano,
        "ponto_extra": ponto_extra,
        "planograma":  planograma,
        "bus": resultado,
        "total_ganho":    round(total_ganho, 2),
        "total_potencial": round(total_potencial, 2),
    }


# ── Endpoints Admin ────────────────────────────────────────────────────────────

class MetaFatInput(BaseModel):
    cd_secao: str
    mes: int
    ano: int
    meta_fat: float


@router.get("/admin/programa-metas")
def get_programa_metas(
    authorization: str = Header(None),
    mes: int = Query(...),
    ano: int = Query(...),
):
    _check_admin(authorization)
    db = get_db()
    rows = db.execute(
        "SELECT cd_secao, meta_fat FROM programa_meta_fat WHERE mes=? AND ano=?",
        (mes, ano),
    ).fetchall()
    db.close()
    return {r["cd_secao"]: r["meta_fat"] for r in rows}


@router.post("/admin/programa-metas")
def set_programa_meta(body: MetaFatInput, authorization: str = Header(None)):
    _check_admin(authorization)
    db = get_db()
    db.execute(
        """INSERT INTO programa_meta_fat (cd_secao, mes, ano, meta_fat)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(cd_secao, mes, ano) DO UPDATE SET meta_fat=excluded.meta_fat""",
        (body.cd_secao, body.mes, body.ano, body.meta_fat),
    )
    db.commit()
    db.close()
    return {"ok": True}


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
