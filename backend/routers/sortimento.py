from fastapi import APIRouter, HTTPException, Query
from database import get_connection
from datetime import date
from routers.metas import get_db
from curva_abc import get_curva_abc_map

router = APIRouter()


@router.get("/sortimento")
def get_sortimento(
    cd_cliens: str = Query(...),
    n_lojas: int = Query(...),
    mes: int = Query(None),
    ano: int = Query(None),
):
    hoje = date.today()
    mes = mes or hoje.month
    ano = ano or hoje.year

    ids = [int(x.strip()) for x in cd_cliens.split(",")]
    placeholders = ",".join("?" * len(ids))
    min_unidades = n_lojas * 3

    # Q1: Vendas do período — faturado (nota) + pedidos em aberto (it_pedv)
    sql_vendas = f"""
        SELECT
            s.cd_secao, s.descricao AS bu,
            p.cd_barra AS ean, p.cd_prod, p.descricao AS produto,
            p.cd_prod_fabric AS cod_fabricante,
            p.cd_barra_compra AS dun,
            p.cd_prod_ncm AS ncm,
            p.qtde_unid_cmp AS fator_caixa,
            SUM(v.unidades) AS unidades_vendidas
        FROM (
            SELECT in2.cd_prod,
                   CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) > 0
                        THEN (in2.qtde - ISNULL(in2.qtde_dev,0)) * in2.fator_est_vda
                        ELSE 0 END AS unidades
            FROM ped_vda pv
            JOIN nota n ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
            JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
            WHERE pv.cd_clien IN ({placeholders})
                AND LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
                AND n.situacao IN ('AB','DP') AND n.tipo_nf = 'S'
                AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
                AND YEAR(n.dt_emis) = {ano} AND MONTH(n.dt_emis) = {mes}

            UNION ALL

            SELECT ip.cd_prod, ip.qtde * ip.fator_est_ped AS unidades
            FROM ped_vda pv
            JOIN it_pedv ip ON ip.nu_ped = pv.nu_ped AND ip.cd_emp = pv.cd_emp
            WHERE pv.cd_clien IN ({placeholders})
                AND pv.cfop IN ('5101','5102','5405','5922','6102')
                AND pv.situacao = 'AB'
                AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
                AND YEAR(pv.dt_cad) = {ano} AND MONTH(pv.dt_cad) = {mes}
        ) v
        JOIN produto p ON p.cd_prod = v.cd_prod
        JOIN linha l ON l.cd_linha = p.cd_linha
        JOIN secao s ON s.cd_secao = l.cd_secao
        WHERE p.cd_fabric = 'UNILEV'
          AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
        GROUP BY s.cd_secao, s.descricao, p.cd_barra, p.cd_prod, p.descricao,
                 p.cd_prod_fabric, p.cd_barra_compra, p.cd_prod_ncm, p.qtde_unid_cmp
    """

    # Q2: Base de EANs Unilever com estoque disponível (matriz cd_emp=1 + filial cd_emp=3)
    sql_estoque = """
        SELECT p.cd_prod, p.cd_barra AS ean, p.cd_barra_compra AS dun,
               p.cd_prod_ncm AS ncm, p.cd_prod_fabric AS cod_fabricante,
               p.qtde_unid_cmp AS fator_caixa,
               p.unid_cmp,
               p.qtde_multipla,
               p.descricao AS produto, s.cd_secao, s.descricao AS bu,
               p.dt_cad,
               SUM(CASE WHEN e.cd_emp = 1 THEN e.qtde - ISNULL(e.qtde_pend_pedv,0) ELSE 0 END) AS estoque_matriz,
               SUM(CASE WHEN e.cd_emp = 3 THEN e.qtde - ISNULL(e.qtde_pend_pedv,0) ELSE 0 END) AS estoque_filial
        FROM produto p
        JOIN linha l ON l.cd_linha = p.cd_linha
        JOIN secao s ON s.cd_secao = l.cd_secao
        JOIN estoque e ON e.cd_prod = p.cd_prod AND e.cd_local = 'CENTRAL' AND e.cd_emp IN (1,3)
        WHERE p.cd_fabric = 'UNILEV' AND p.ativo = 1
            AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
        GROUP BY p.cd_prod, p.cd_barra, p.cd_barra_compra, p.cd_prod_ncm, p.cd_prod_fabric,
                 p.qtde_unid_cmp, p.unid_cmp, p.qtde_multipla, p.descricao, s.cd_secao, s.descricao, p.dt_cad
        HAVING SUM(CASE WHEN e.cd_emp = 1 THEN e.qtde - ISNULL(e.qtde_pend_pedv,0) ELSE 0 END) > 0
    """

    # Q3: Histórico completo — faturado (nota) + pedidos em aberto (it_pedv)
    sql_historico = f"""
        SELECT DISTINCT v.cd_prod FROM (
            SELECT in2.cd_prod
            FROM ped_vda pv
            JOIN nota n ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
            JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
            WHERE pv.cd_clien IN ({placeholders})
                AND LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
                AND n.situacao IN ('AB','DP') AND n.tipo_nf = 'S'
                AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')

            UNION ALL

            SELECT ip.cd_prod
            FROM ped_vda pv
            JOIN it_pedv ip ON ip.nu_ped = pv.nu_ped AND ip.cd_emp = pv.cd_emp
            WHERE pv.cd_clien IN ({placeholders})
                AND pv.cfop IN ('5101','5102','5405','5922','6102')
                AND pv.situacao = 'AB'
                AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
        ) v
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # ids duplicados: primeiro bloco faturado, segundo bloco abertos
        cursor.execute(sql_vendas, ids + ids)
        vendas_rows = cursor.fetchall()

        cursor.execute(sql_estoque)
        estoque_rows = cursor.fetchall()

        cursor.execute(sql_historico, ids + ids)
        historico_rows = cursor.fetchall()

        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Agrega unidades por EAN (UNION ALL pode ter 2 linhas: nota + pedido aberto)
    vendas_map = {}
    for r in vendas_rows:
        un = int(r.unidades_vendidas or 0)
        if r.ean in vendas_map:
            vendas_map[r.ean] += un
        else:
            vendas_map[r.ean] = un

    historico_set = {r.cd_prod for r in historico_rows}

    db = get_db()
    sortimento_set = {r["ean"] for r in db.execute("SELECT ean FROM sortimento_ean").fetchall()}
    db.close()

    curva_abc_map = get_curva_abc_map()

    hoje = date.today()

    seen_eans = set()
    result = []
    for e in estoque_rows:
        if e.ean in seen_eans:
            continue
        seen_eans.add(e.ean)
        unidades = vendas_map.get(e.ean, 0)

        if unidades >= min_unidades:
            status = "positivado"
        elif unidades > 0:
            status = "em_progresso"
        elif e.cd_prod in historico_set:
            status = "pendente"
        else:
            status = "nunca_comprou"

        is_novo = bool(e.dt_cad) and (hoje - e.dt_cad.date()).days <= 60

        result.append({
            "cd_prod": e.cd_prod,
            "ean": e.ean,
            "dun": e.dun,
            "ncm": e.ncm,
            "cod_fabricante": e.cod_fabricante,
            "fator_caixa": e.fator_caixa,
            "unid_cmp": (e.unid_cmp or "").strip(),
            "qtde_multipla": e.qtde_multipla,
            "produto": e.produto.strip(),
            "cd_secao": e.cd_secao.strip(),
            "bu": e.bu.strip(),
            "unidades_vendidas": unidades,
            "minimo": min_unidades,
            "status": status,
            "estoque_matriz": int(e.estoque_matriz or 0),
            "estoque_filial": int(e.estoque_filial or 0),
            "is_novo": is_novo,
            "is_sortimento": e.ean in sortimento_set,
            "curva_abc": curva_abc_map.get(e.cd_prod),
        })

    return {
        "itens": result,
        "minimo": min_unidades,
        "n_lojas": n_lojas,
        "periodo": {"mes": mes, "ano": ano},
    }


@router.get("/pedidos-abertos")
def get_pedidos_abertos(cd_cliens: str = Query(...)):
    """Todos os pedidos Unilever em aberto do cliente (sem filtro de período)."""
    ids = [int(x.strip()) for x in cd_cliens.split(",")]
    placeholders = ",".join("?" * len(ids))

    sql = f"""
        SELECT
            pv.nu_ped,
            CAST(pv.dt_cad AS DATE) AS dt_pedido,
            p.cd_barra AS ean,
            p.descricao AS produto,
            p.cd_prod_fabric AS cod_fabricante,
            s.cd_secao,
            s.descricao AS bu,
            SUM(ip.qtde * ip.fator_est_ped) AS unidades
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
        GROUP BY pv.nu_ped, pv.dt_cad, p.cd_barra, p.descricao, p.cd_prod_fabric,
                 s.cd_secao, s.descricao
        ORDER BY pv.dt_cad DESC, pv.nu_ped
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
            "ean": r.ean,
            "produto": r.produto.strip() if r.produto else "",
            "cod_fabricante": r.cod_fabricante or "",
            "cd_secao": r.cd_secao.strip(),
            "bu": r.bu.strip(),
            "unidades": int(r.unidades) if r.unidades else 0,
        }
        for r in rows
    ]
