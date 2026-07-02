from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_connection
from routers.metas import verificar_senha_cliente

router = APIRouter()

class LoginRequest(BaseModel):
    cnpj: str
    senha: str

def normalize_cnpj(cnpj: str) -> str:
    return cnpj.replace(".", "").replace("-", "").replace("/", "").replace(" ", "")

@router.post("/login")
def login(req: LoginRequest):
    cnpj = normalize_cnpj(req.cnpj)
    if len(cnpj) != 14:
        raise HTTPException(status_code=400, detail="CNPJ inválido")

    cnpj_raiz = cnpj[:8]

    sql = """
        SELECT
            c.cd_clien, c.nome, c.cgc_cpf,
            r.descricao AS segmento,
            r.ram_ativ AS cod_segmento,
            LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8) AS cnpj_raiz,
            COUNT(*) OVER (PARTITION BY LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8)) AS total_lojas
        FROM cliente c
        JOIN CliSegmentoFabric csf ON csf.CdClien = c.cd_clien
        JOIN ram_ativ r ON r.ram_ativ = csf.RamAtiv
        WHERE csf.CdFabric = 'UNILEV'
            AND csf.RamAtiv IN ('33  ','34  ')
            AND c.ativo = 1
            AND LEFT(REPLACE(REPLACE(REPLACE(REPLACE(c.cgc_cpf,'.',''),'-',''),'/',''),' ',''), 8) = ?
    """

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql, cnpj_raiz)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not rows:
        raise HTTPException(status_code=401, detail="CNPJ ou senha incorretos")

    # Verifica se o CNPJ digitado é uma das lojas do grupo
    cnpjs_grupo = [normalize_cnpj(r.cgc_cpf) for r in rows]
    if cnpj not in cnpjs_grupo:
        raise HTTPException(status_code=401, detail="CNPJ ou senha incorretos")

    # Verifica senha
    if not verificar_senha_cliente(cnpj_raiz, req.senha):
        raise HTTPException(status_code=401, detail="CNPJ ou senha incorretos")

    first = rows[0]
    cd_cliens = [r.cd_clien for r in rows]

    return {
        "cd_clien": first.cd_clien,
        "nome": first.nome.strip(),
        "cnpj_raiz": first.cnpj_raiz,
        "segmento": first.segmento.strip(),
        "total_lojas": first.total_lojas,
        "cd_cliens": cd_cliens,
        "lojas": [
            {
                "cd_clien": r.cd_clien,
                "nome": r.nome.strip(),
                "cgc_cpf": r.cgc_cpf.strip(),
            }
            for r in rows
        ]
    }
