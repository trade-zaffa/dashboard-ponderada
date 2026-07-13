import time
from database import get_connection
from programa_config import get_incluir_avista, filtro_avista

_CACHE = {"map": {}, "ts": 0, "incluir_avista": None}
_TTL_SECONDS = 6 * 60 * 60  # 6 horas


def _sql(incluir_avista: bool) -> str:
    return f"""
WITH vendas AS (
    SELECT p.cd_prod,
           SUM(CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) <= 0 THEN 0
                ELSE in2.vl_tot_liquido * (in2.qtde - ISNULL(in2.qtde_dev,0)) / NULLIF(in2.qtde,0)
                END) AS vl_faturado
    FROM ped_vda pv
    JOIN nota n      ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
    JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
    JOIN produto p   ON p.cd_prod = in2.cd_prod
    JOIN linha l     ON l.cd_linha = p.cd_linha
    JOIN secao s     ON s.cd_secao = l.cd_secao
    JOIN cliente c   ON c.cd_clien = pv.cd_clien
    JOIN CliSegmentoFabric csf ON csf.CdClien = c.cd_clien
    LEFT JOIN promocao pr ON pr.seq_prom = pv.seq_prom
    WHERE csf.CdFabric = 'UNILEV'
      AND csf.RamAtiv IN ('33  ','34  ')
      AND c.ativo = 1
      AND LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
      AND n.situacao IN ('AB','DP') AND n.tipo_nf = 'S'
      AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
      AND p.cd_fabric = 'UNILEV'
      AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
      AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
      {filtro_avista(incluir_avista)}
      AND n.dt_emis >= DATEADD(MONTH, -12, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
    GROUP BY p.cd_prod
),
ranked AS (
    SELECT cd_prod, vl_faturado,
           SUM(vl_faturado) OVER (ORDER BY vl_faturado DESC ROWS UNBOUNDED PRECEDING) AS acumulado,
           SUM(vl_faturado) OVER () AS total_geral
    FROM vendas
    WHERE vl_faturado > 0
)
SELECT cd_prod,
       CASE
           WHEN acumulado * 100.0 / NULLIF(total_geral,0) <= 80 THEN 'A'
           WHEN acumulado * 100.0 / NULLIF(total_geral,0) <= 95 THEN 'B'
           ELSE 'C'
       END AS curva_abc
FROM ranked
"""


def get_curva_abc_map() -> dict:
    """cd_prod -> 'A'|'B'|'C', calculado sobre faturamento Unilever dos ultimos 12 meses.
    Cacheado em memoria por _TTL_SECONDS (ou ate a flag incluir_avista mudar)."""
    incluir_avista = get_incluir_avista()
    agora = time.time()
    if (_CACHE["map"] and (agora - _CACHE["ts"]) < _TTL_SECONDS
            and _CACHE["incluir_avista"] == incluir_avista):
        return _CACHE["map"]

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(_sql(incluir_avista))
    mapa = {r.cd_prod: r.curva_abc for r in cur.fetchall()}
    conn.close()

    _CACHE["map"] = mapa
    _CACHE["ts"] = agora
    _CACHE["incluir_avista"] = incluir_avista
    return mapa
