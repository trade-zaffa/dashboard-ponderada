from fastapi import APIRouter, HTTPException, Query
from database import get_connection
from programa_config import filtro_avista

router = APIRouter()

# /faturamento e usado apenas pelo cliente -- prazo A VISTA - (4 DIAS)
# sempre fica excluido aqui, independente da flag "Rede" (admin-only).


def _vl_expr(alias='in2'):
    return f"""CASE WHEN ({alias}.qtde - ISNULL({alias}.qtde_dev,0)) <= 0 THEN 0
               ELSE {alias}.vl_tot_liquido * ({alias}.qtde - ISNULL({alias}.qtde_dev,0)) / NULLIF({alias}.qtde,0)
               END"""


def _base_joins(placeholders):
    incluir_avista = False
    return f"""
        FROM ped_vda pv
        JOIN nota n      ON n.nu_ped  = pv.nu_ped AND n.cd_emp = pv.cd_emp
        JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
        JOIN produto p   ON p.cd_prod  = in2.cd_prod
        JOIN linha l     ON l.cd_linha = p.cd_linha
        JOIN secao s     ON s.cd_secao = l.cd_secao
        LEFT JOIN promocao pr ON pr.seq_prom = pv.seq_prom
        WHERE pv.cd_clien IN ({placeholders})
          AND LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
          AND n.situacao IN ('AB','DP')
          AND n.tipo_nf = 'S'
          AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
          AND p.cd_fabric = 'UNILEV'
          AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
          AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
          {filtro_avista(incluir_avista)}
    """


@router.get("/faturamento")
def get_faturamento(cd_cliens: str = Query(...)):
    ids = [int(x.strip()) for x in cd_cliens.split(",")]
    ph  = ",".join("?" * len(ids))

    sql_historico = f"""
        SELECT
            YEAR(n.dt_emis)  AS ano,
            MONTH(n.dt_emis) AS mes,
            s.cd_secao,
            SUM({_vl_expr()}) AS vl_faturado,
            SUM(in2.qtde - ISNULL(in2.qtde_dev,0)) AS qtde_liquida
        {_base_joins(ph)}
          AND n.dt_emis >= DATEADD(MONTH, -12,
                DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
        GROUP BY YEAR(n.dt_emis), MONTH(n.dt_emis), s.cd_secao
        ORDER BY ano DESC, mes DESC, s.cd_secao
    """

    sql_kpis = f"""
        SELECT
            s.cd_secao,
            SUM(CASE
                WHEN YEAR(n.dt_emis)  = YEAR(GETDATE())
                 AND MONTH(n.dt_emis) = MONTH(GETDATE())
                THEN {_vl_expr()} ELSE 0 END) AS vl_mes_atual,
            SUM(CASE
                WHEN YEAR(n.dt_emis)  = YEAR(DATEADD(MONTH,-1,GETDATE()))
                 AND MONTH(n.dt_emis) = MONTH(DATEADD(MONTH,-1,GETDATE()))
                THEN {_vl_expr()} ELSE 0 END) AS vl_mes_anterior
        {_base_joins(ph)}
          AND n.dt_emis >= DATEFROMPARTS(
                YEAR(DATEADD(MONTH,-1,GETDATE())),
                MONTH(DATEADD(MONTH,-1,GETDATE())), 1)
        GROUP BY s.cd_secao
    """


    try:
        conn   = get_connection()
        cursor = conn.cursor()

        cursor.execute(sql_historico, ids)
        historico = [
            {"ano": r.ano, "mes": r.mes, "cd_secao": r.cd_secao.strip(),
             "vl_faturado": float(r.vl_faturado or 0),
             "qtde_liquida": float(r.qtde_liquida or 0)}
            for r in cursor.fetchall()
        ]

        cursor.execute(sql_kpis, ids)
        kpis = [
            {"cd_secao": r.cd_secao.strip(),
             "vl_mes_atual":    float(r.vl_mes_atual    or 0),
             "vl_mes_anterior": float(r.vl_mes_anterior or 0)}
            for r in cursor.fetchall()
        ]

        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"historico": historico, "kpis": kpis}
