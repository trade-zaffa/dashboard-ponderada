from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from database import get_connection
from datetime import date
import os

router = APIRouter()


def verificar_admin(authorization: str = Header(None)):
    senha = os.getenv("ADMIN_PASSWORD", "admin123")
    if authorization != f"Bearer {senha}":
        raise HTTPException(status_code=401, detail="Acesso não autorizado")


class AdminLogin(BaseModel):
    senha: str


@router.post("/admin/login")
def admin_login(req: AdminLogin):
    senha = os.getenv("ADMIN_PASSWORD", "admin123")
    if req.senha != senha:
        raise HTTPException(status_code=401, detail="Senha incorreta")
    return {"token": senha, "ok": True}


@router.get("/admin/clientes")
def admin_clientes(authorization: str = Header(None)):
    verificar_admin(authorization)
    sql = """
        SELECT
            MIN(c.cd_clien) AS cd_clien,
            MIN(c.nome) AS nome,
            r.descricao AS segmento,
            LEFT(c.cgc_cpf, 8) AS cnpj_raiz,
            COUNT(*) AS total_lojas,
            STRING_AGG(CAST(c.cd_clien AS VARCHAR), ',') AS cd_cliens
        FROM cliente c
        JOIN CliSegmentoFabric csf ON csf.CdClien = c.cd_clien
        JOIN ram_ativ r ON r.ram_ativ = csf.RamAtiv
        WHERE csf.CdFabric = 'UNILEV'
            AND csf.RamAtiv IN ('33  ','34  ')
            AND c.ativo = 1
        GROUP BY LEFT(c.cgc_cpf, 8), r.descricao
        ORDER BY MIN(c.nome)
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return [
        {
            "cd_clien": r.cd_clien,
            "nome": r.nome.strip().lstrip(".@"),
            "segmento": r.segmento.strip(),
            "cnpj_raiz": r.cnpj_raiz,
            "total_lojas": r.total_lojas,
            "cd_cliens": [int(x) for x in r.cd_cliens.split(",")],
        }
        for r in rows
    ]


@router.get("/admin/sortimento-resumo")
def admin_sortimento_resumo(
    authorization: str = Header(None),
    mes: int = Query(None),
    ano: int = Query(None),
):
    verificar_admin(authorization)
    hoje = date.today()
    mes = mes or hoje.month
    ano = ano or hoje.year

    sql = f"""
        WITH base AS (
            SELECT DISTINCT p.cd_prod, s.cd_secao
            FROM produto p
            JOIN linha l ON l.cd_linha = p.cd_linha
            JOIN secao s ON s.cd_secao = l.cd_secao
            JOIN estoque e ON e.cd_prod = p.cd_prod AND e.cd_local = 'CENTRAL'
            WHERE p.cd_fabric = 'UNILEV'
              AND p.ativo = 1
              AND s.cd_secao IN ('LMP_CASA','AL_NUT','LMP_CUPE','HGPER_BB')
              AND (e.qtde - ISNULL(e.qtde_pend_pedv,0)) > 0
        ),
        grupos AS (
            SELECT
                LEFT(c.cgc_cpf, 8) AS cnpj_raiz,
                MIN(c.nome) AS nome,
                COUNT(*) AS n_lojas
            FROM cliente c
            JOIN CliSegmentoFabric csf ON csf.CdClien = c.cd_clien
            WHERE csf.CdFabric = 'UNILEV'
              AND csf.RamAtiv IN ('33  ','34  ')
              AND c.ativo = 1
            GROUP BY LEFT(c.cgc_cpf, 8)
        ),
        vendas_bruta AS (
            -- Faturado no período
            SELECT LEFT(c.cgc_cpf, 8) AS cnpj_raiz, in2.cd_prod,
                   CASE WHEN (in2.qtde - ISNULL(in2.qtde_dev,0)) > 0
                        THEN (in2.qtde - ISNULL(in2.qtde_dev,0)) * in2.fator_est_vda
                        ELSE 0 END AS unid
            FROM ped_vda pv
            JOIN nota n ON n.nu_ped = pv.nu_ped AND n.cd_emp = pv.cd_emp
            JOIN it_nota in2 ON in2.nu_nf = n.nu_nf
            JOIN cliente c ON c.cd_clien = pv.cd_clien
            WHERE LEFT(LTRIM(n.desc_cfop),4) IN ('5101','5102','5405','5922','6102')
              AND n.situacao IN ('AB','DP') AND n.tipo_nf = 'S'
              AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
              AND YEAR(n.dt_emis) = {ano} AND MONTH(n.dt_emis) = {mes}

            UNION ALL

            -- Pedidos em aberto no período
            SELECT LEFT(c.cgc_cpf, 8) AS cnpj_raiz, ip.cd_prod,
                   ip.qtde * ip.fator_est_ped AS unid
            FROM ped_vda pv
            JOIN it_pedv ip ON ip.nu_ped = pv.nu_ped AND ip.cd_emp = pv.cd_emp
            JOIN cliente c ON c.cd_clien = pv.cd_clien
            WHERE pv.cfop IN ('5101','5102','5405','5922','6102')
              AND pv.situacao = 'AB'
              AND pv.tp_ped IN ('BO','SF','EX','EC','VZ','VE','PP','ZF')
              AND YEAR(pv.dt_cad) = {ano} AND MONTH(pv.dt_cad) = {mes}
        ),
        vendas_mes AS (
            SELECT cnpj_raiz, cd_prod, SUM(unid) AS unid
            FROM vendas_bruta
            GROUP BY cnpj_raiz, cd_prod
        )
        SELECT
            g.cnpj_raiz,
            b.cd_secao AS bu,
            g.n_lojas,
            COUNT(DISTINCT b.cd_prod) AS total_eans,
            COUNT(DISTINCT CASE WHEN v.unid >= g.n_lojas * 3 THEN b.cd_prod END) AS positivado,
            COUNT(DISTINCT CASE WHEN v.unid > 0 AND v.unid < g.n_lojas * 3 THEN b.cd_prod END) AS em_progresso,
            COUNT(DISTINCT CASE WHEN v.unid IS NULL THEN b.cd_prod END) AS sem_venda
        FROM grupos g
        CROSS JOIN base b
        LEFT JOIN vendas_mes v ON v.cnpj_raiz = g.cnpj_raiz AND v.cd_prod = b.cd_prod
        GROUP BY g.cnpj_raiz, b.cd_secao, g.n_lojas
        ORDER BY g.cnpj_raiz, b.cd_secao
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    resultado = {}
    for r in rows:
        key = r.cnpj_raiz
        if key not in resultado:
            resultado[key] = {"cnpj_raiz": key, "bus": {}}
        resultado[key]["bus"][r.bu.strip()] = {
            "total": r.total_eans,
            "positivado": r.positivado,
            "em_progresso": r.em_progresso,
            "sem_venda": r.sem_venda,
        }
    return resultado
