from fastapi import APIRouter, HTTPException, Query, Header
from database import get_connection
from curva_abc import get_curva_abc_map
import os

router = APIRouter()


def _verificar_admin(authorization: str):
    senha = os.getenv("ADMIN_PASSWORD", "admin123")
    if authorization != f"Bearer {senha}":
        raise HTTPException(status_code=401, detail="Acesso não autorizado")


def _vl_fat(alias='in2'):
    return (
        f"CASE WHEN ({alias}.qtde - ISNULL({alias}.qtde_dev,0)) <= 0 THEN 0 "
        f"ELSE {alias}.vl_tot_liquido * ({alias}.qtde - ISNULL({alias}.qtde_dev,0)) "
        f"/ NULLIF({alias}.qtde,0) END"
    )


@router.get("/pedidos-abertos")
def get_pedidos_abertos(cd_cliens: str = Query(...)):
    """Resumo por BU: faturado no mês atual vs em aberto."""
    ids = [int(x.strip()) for x in cd_cliens.split(",")]
    ph = ",".join("?" * len(ids))

    sql_fat = f"""
        SELECT s.cd_secao,
               SUM({_vl_fat()}) AS vl_faturado
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
          AND MONTH(n.dt_emis) = MONTH(GETDATE())
          AND YEAR(n.dt_emis) = YEAR(GETDATE())
        GROUP BY s.cd_secao
    """

    sql_abe = f"""
        SELECT s.cd_secao,
               COUNT(DISTINCT pv.nu_ped) AS qtd_pedidos,
               SUM(ip.qtde * COALESCE(ip.vl_unit_ped / NULLIF(ip.fator_est_ped,0), ip.vl_unit_ped)) AS vl_aberto
        FROM ped_vda pv
        JOIN it_pedv ip ON ip.nu_ped = pv.nu_ped AND ip.cd_emp = pv.cd_emp
        JOIN produto p  ON p.cd_prod = ip.cd_prod
        JOIN linha l    ON l.cd_linha = p.cd_linha
        JOIN secao s    ON s.cd_secao = l.cd_secao
        WHERE pv.cd_clien IN ({ph})
          AND pv.cfop IN ('5101','5102','5405','5922','6102')
          AND pv.situacao = 'AB'
          AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
          AND p.cd_fabric = 'UNILEV'
          AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
          AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
          AND MONTH(pv.dt_cad) = MONTH(GETDATE())
          AND YEAR(pv.dt_cad) = YEAR(GETDATE())
        GROUP BY s.cd_secao
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(sql_fat, ids)
        fat_map = {r.cd_secao.strip(): float(r.vl_faturado or 0) for r in cursor.fetchall()}

        cursor.execute(sql_abe, ids)
        abe_rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    BUS = ['LMP_CASA', 'AL_NUT', 'LMP_CUPE', 'HGPER_BB']
    abe_map = {r.cd_secao.strip(): r for r in abe_rows}

    return [
        {
            "cd_secao": bu,
            "vl_faturado": fat_map.get(bu, 0.0),
            "vl_aberto": float(abe_map[bu].vl_aberto) if bu in abe_map else 0.0,
            "qtd_pedidos": int(abe_map[bu].qtd_pedidos) if bu in abe_map else 0,
        }
        for bu in BUS
    ]


@router.get("/pedidos")
def get_pedidos(cd_cliens: str = Query(...)):
    """Lista todos os pedidos em aberto do cliente com etapa do workflow e totais."""
    ids = [int(x.strip()) for x in cd_cliens.split(",")]
    placeholders = ",".join("?" * len(ids))

    sql = f"""
        SELECT
            pv.nu_ped,
            CAST(pv.dt_cad AS DATE) AS dt_pedido,
            pv.cfop,
            pv.tp_ped,
            pv.InicioProcessoFatura,
            (
                SELECT STRING_AGG(ISNULL(f2.des_fila, 'SEM FILA'), ' / ')
                FROM evento e2
                LEFT JOIN fila f2 ON f2.cd_fila = e2.cd_fila
                WHERE e2.nu_ped = pv.nu_ped
                  AND e2.cd_emp = pv.cd_emp
                  AND e2.dt_encer IS NULL
            ) AS etapas,
            (
                SELECT STRING_AGG(e2.cd_fila, ',')
                FROM evento e2
                WHERE e2.nu_ped = pv.nu_ped
                  AND e2.cd_emp = pv.cd_emp
                  AND e2.dt_encer IS NULL
            ) AS cd_filas,
            COUNT(DISTINCT p.cd_prod) AS qtd_produtos,
            SUM(ip.qtde * ip.fator_est_ped) AS total_unidades,
            ROUND(SUM(ip.qtde * COALESCE(
                ip.vl_unit_ped / NULLIF(ip.fator_est_ped, 0),
                ip.vl_unit_ped
            )), 2) AS valor_estimado
        FROM ped_vda pv
        JOIN it_pedv ip ON ip.nu_ped = pv.nu_ped AND ip.cd_emp = pv.cd_emp
        JOIN produto p ON p.cd_prod = ip.cd_prod
        JOIN linha l ON l.cd_linha = p.cd_linha
        JOIN secao s ON s.cd_secao = l.cd_secao
        WHERE pv.cd_clien IN ({placeholders})
            AND pv.cfop IN ('5101','5102','5405','5922','6102')
            AND pv.situacao = 'AB'
            AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
            AND p.cd_fabric = 'UNILEV'
            AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
            AND MONTH(pv.dt_cad) = MONTH(GETDATE())
            AND YEAR(pv.dt_cad) = YEAR(GETDATE())
        GROUP BY pv.nu_ped, pv.dt_cad, pv.cfop, pv.tp_ped, pv.InicioProcessoFatura, pv.cd_emp
        ORDER BY pv.dt_cad DESC
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql, ids)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return [
        {
            "nu_ped": r.nu_ped,
            "dt_pedido": str(r.dt_pedido),
            "cfop": r.cfop,
            "tp_ped": r.tp_ped.strip() if r.tp_ped else "",
            "inicio_fatura": r.InicioProcessoFatura,
            "etapas": r.etapas or "",
            "cd_filas": r.cd_filas or "",
            "qtd_produtos": r.qtd_produtos,
            "total_unidades": int(r.total_unidades) if r.total_unidades else 0,
            "valor_estimado": float(r.valor_estimado) if r.valor_estimado else 0.0,
        }
        for r in rows
    ]


@router.get("/pedidos/{nu_ped}/itens")
def get_pedido_itens(nu_ped: int, cd_cliens: str = Query(...)):
    """Retorna itens Unilever de um pedido. Valida posse via cd_cliens."""
    ids = [int(x.strip()) for x in cd_cliens.split(",")]
    placeholders = ",".join("?" * len(ids))

    sql_check = f"""
        SELECT COUNT(*) AS cnt FROM ped_vda
        WHERE nu_ped = ? AND cd_clien IN ({placeholders})
    """
    sql_itens = """
        SELECT
            p.cd_barra AS ean,
            p.descricao AS produto,
            p.cd_prod_fabric AS cod_fabricante,
            s.cd_secao,
            ip.qtde AS qtde_caixas,
            ip.unid_ped,
            ip.fator_est_ped,
            CAST(ROUND(ip.qtde * ip.fator_est_ped, 0) AS INT) AS total_unidades,
            ROUND(ip.vl_unit_ped, 2) AS vl_unit,
            ROUND(ip.qtde * COALESCE(
                ip.vl_unit_ped / NULLIF(ip.fator_est_ped, 0),
                ip.vl_unit_ped
            ), 2) AS valor_item
        FROM it_pedv ip
        JOIN produto p ON p.cd_prod = ip.cd_prod
        JOIN linha l ON l.cd_linha = p.cd_linha
        JOIN secao s ON s.cd_secao = l.cd_secao
        WHERE ip.nu_ped = ?
            AND p.cd_fabric = 'UNILEV'
            AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
        ORDER BY s.cd_secao, p.descricao
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql_check, [nu_ped] + ids)
        check = cursor.fetchone()
        if not check or check.cnt == 0:
            raise HTTPException(status_code=403, detail="Pedido não encontrado")
        cursor.execute(sql_itens, [nu_ped])
        rows = cursor.fetchall()
        conn.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return [
        {
            "ean": r.ean,
            "produto": r.produto.strip() if r.produto else "",
            "cod_fabricante": r.cod_fabricante or "",
            "cd_secao": r.cd_secao.strip(),
            "qtde_caixas": float(r.qtde_caixas),
            "unid_ped": (r.unid_ped or "").strip(),
            "fator_est_ped": r.fator_est_ped,
            "total_unidades": r.total_unidades,
            "vl_unit": float(r.vl_unit) if r.vl_unit else 0.0,
            "valor_item": float(r.valor_item) if r.valor_item else 0.0,
        }
        for r in rows
    ]


@router.get("/admin/pedidos-abertos-mes")
def admin_pedidos_abertos_mes(authorization: str = Header(None)):
    """Pedidos em aberto do mês atual — todos os clientes Ponderada."""
    _verificar_admin(authorization)

    sql = """
        SELECT
            c.nome                                                         AS cliente,
            pv.nu_ped,
            CAST(pv.dt_cad AS DATE)                                        AS dt_pedido,
            s.cd_secao,
            p.cd_barra                                                     AS ean,
            p.descricao                                                    AS produto,
            ip.qtde                                                        AS qtde_cx,
            ip.unid_ped,
            CAST(ROUND(ip.qtde * ip.fator_est_ped, 0) AS INT)             AS total_un,
            ROUND(ip.qtde * COALESCE(
                ip.vl_unit_ped / NULLIF(ip.fator_est_ped, 0),
                ip.vl_unit_ped
            ), 2)                                                          AS valor_item,
            (
                SELECT STRING_AGG(ISNULL(f2.des_fila,'SEM FILA'), ' / ')
                FROM evento e2
                LEFT JOIN fila f2 ON f2.cd_fila = e2.cd_fila
                WHERE e2.nu_ped = pv.nu_ped AND e2.cd_emp = pv.cd_emp AND e2.dt_encer IS NULL
            )                                                              AS etapa
        FROM ped_vda pv
        JOIN it_pedv ip            ON ip.nu_ped = pv.nu_ped AND ip.cd_emp = pv.cd_emp
        JOIN produto p             ON p.cd_prod = ip.cd_prod
        JOIN linha l               ON l.cd_linha = p.cd_linha
        JOIN secao s               ON s.cd_secao = l.cd_secao
        JOIN cliente c             ON c.cd_clien = pv.cd_clien
        JOIN CliSegmentoFabric csf ON csf.CdClien = c.cd_clien
        WHERE csf.CdFabric = 'UNILEV'
          AND csf.RamAtiv IN ('33  ','34  ')
          AND c.ativo = 1
          AND pv.cfop IN ('5101','5102','5405','5922','6102')
          AND pv.situacao = 'AB'
          AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
          AND p.cd_fabric = 'UNILEV'
          AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
          AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
          AND MONTH(pv.dt_cad) = MONTH(GETDATE())
          AND YEAR(pv.dt_cad) = YEAR(GETDATE())
        ORDER BY c.nome, pv.nu_ped, s.cd_secao
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return [
        {
            "cliente":    r.cliente.strip() if r.cliente else "",
            "nu_ped":     r.nu_ped,
            "dt_pedido":  str(r.dt_pedido),
            "cd_secao":   r.cd_secao.strip(),
            "ean":        r.ean or "",
            "produto":    r.produto.strip() if r.produto else "",
            "qtde_cx":    float(r.qtde_cx) if r.qtde_cx else 0.0,
            "unid_ped":   (r.unid_ped or "").strip(),
            "total_un":   int(r.total_un) if r.total_un else 0,
            "valor_item": float(r.valor_item) if r.valor_item else 0.0,
            "etapa":      r.etapa or "",
        }
        for r in rows
    ]


@router.get("/admin/pedidos-faturados-mes")
def admin_pedidos_faturados_mes(authorization: str = Header(None)):
    """Faturamento do mês atual — todos os clientes Ponderada."""
    _verificar_admin(authorization)

    sql = """
        SELECT
            c.nome                                                         AS cliente,
            n.nu_nf,
            CAST(n.dt_emis AS DATE)                                        AS dt_emissao,
            s.cd_secao,
            p.cd_barra                                                     AS ean,
            p.descricao                                                    AS produto,
            in2.qtde - ISNULL(in2.qtde_dev, 0)                            AS qtde_liquida,
            ROUND(
                CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) <= 0 THEN 0
                     ELSE in2.vl_tot_liquido * (in2.qtde - ISNULL(in2.qtde_dev,0))
                          / NULLIF(in2.qtde, 0)
                END
            , 2)                                                           AS valor_liquido
        FROM ped_vda pv
        JOIN nota n            ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
        JOIN it_nota in2       ON in2.nu_nf = n.nu_nf
        JOIN produto p         ON p.cd_prod = in2.cd_prod
        JOIN linha l           ON l.cd_linha = p.cd_linha
        JOIN secao s           ON s.cd_secao = l.cd_secao
        JOIN cliente c         ON c.cd_clien = pv.cd_clien
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
          AND MONTH(n.dt_emis) = MONTH(GETDATE())
          AND YEAR(n.dt_emis) = YEAR(GETDATE())
        ORDER BY c.nome, n.dt_emis DESC, s.cd_secao
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return [
        {
            "cliente":      r.cliente.strip() if r.cliente else "",
            "nu_nf":        r.nu_nf,
            "dt_emissao":   str(r.dt_emissao),
            "cd_secao":     r.cd_secao.strip(),
            "ean":          r.ean or "",
            "produto":      r.produto.strip() if r.produto else "",
            "qtde_liquida": float(r.qtde_liquida) if r.qtde_liquida else 0.0,
            "valor_liquido": float(r.valor_liquido) if r.valor_liquido else 0.0,
        }
        for r in rows
    ]


@router.get("/admin/estoque")
def admin_estoque(authorization: str = Header(None)):
    """Estoque (matriz + filial) de todos os EANs Unilever ativos."""
    _verificar_admin(authorization)

    sql = """
        SELECT p.cd_prod, p.cd_barra AS ean, p.descricao AS produto,
               s.cd_secao, p.qtde_unid_cmp AS fator_caixa,
               SUM(CASE WHEN e.cd_emp = 1 THEN e.qtde - ISNULL(e.qtde_pend_pedv,0) ELSE 0 END) AS estoque_matriz,
               SUM(CASE WHEN e.cd_emp = 3 THEN e.qtde - ISNULL(e.qtde_pend_pedv,0) ELSE 0 END) AS estoque_filial
        FROM produto p
        JOIN linha l ON l.cd_linha = p.cd_linha
        JOIN secao s ON s.cd_secao = l.cd_secao
        LEFT JOIN estoque e ON e.cd_prod = p.cd_prod AND e.cd_local = 'CENTRAL' AND e.cd_emp IN (1,3)
        WHERE p.cd_fabric = 'UNILEV' AND p.ativo = 1
            AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
            AND s.descricao NOT LIKE '%DISPLAY/EXPOSITOR%'
        GROUP BY p.cd_prod, p.cd_barra, p.descricao, s.cd_secao, p.qtde_unid_cmp
        ORDER BY s.cd_secao, p.descricao
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    curva_abc_map = get_curva_abc_map()

    return [
        {
            "cd_prod": r.cd_prod,
            "ean": r.ean or "",
            "produto": r.produto.strip() if r.produto else "",
            "cd_secao": r.cd_secao.strip(),
            "fator_caixa": r.fator_caixa,
            "estoque_matriz": int(r.estoque_matriz or 0),
            "estoque_filial": int(r.estoque_filial or 0),
            "curva_abc": curva_abc_map.get(r.cd_prod),
        }
        for r in rows
    ]
