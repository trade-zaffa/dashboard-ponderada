from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
import sqlite3
import os
import hashlib
import secrets
from pathlib import Path

router = APIRouter()

DB_PATH = Path(__file__).parent.parent / 'metas.db'


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ponderada_meta (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            cd_secao  TEXT    NOT NULL,
            mes       INTEGER NOT NULL,
            ano       INTEGER NOT NULL,
            meta_eans INTEGER NOT NULL,
            UNIQUE(cd_secao, mes, ano)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS client_passwords (
            cnpj_raiz TEXT PRIMARY KEY,
            senha_hash TEXT NOT NULL,
            criado_em  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()


def _hash(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()


def verificar_senha_cliente(cnpj_raiz: str, senha: str) -> bool:
    conn = get_db()
    row = conn.execute(
        "SELECT senha_hash FROM client_passwords WHERE cnpj_raiz = ?",
        (cnpj_raiz,)
    ).fetchone()
    conn.close()
    if not row:
        return False
    return row["senha_hash"] == _hash(senha)


init_db()


def _check_admin(authorization: str):
    senha = os.getenv("ADMIN_PASSWORD", "admin123")
    if authorization != f"Bearer {senha}":
        raise HTTPException(status_code=401, detail="Não autorizado")


class MetaInput(BaseModel):
    cd_secao: str
    mes: int
    ano: int
    meta_eans: int


# ── Leitura pública (cliente) ──────────────────────────────────────────────────

@router.get("/metas")
def get_metas_cliente(
    mes: int = Query(...),
    ano: int = Query(...),
):
    """Metas globais por BU para o período — sem autenticação."""
    conn = get_db()
    rows = conn.execute(
        "SELECT cd_secao, meta_eans FROM ponderada_meta WHERE mes=? AND ano=?",
        (mes, ano),
    ).fetchall()
    conn.close()
    return {r["cd_secao"]: r["meta_eans"] for r in rows}


# ── Admin ──────────────────────────────────────────────────────────────────────

@router.get("/admin/metas")
def get_metas_admin(
    authorization: str = Header(None),
    mes: int = Query(...),
    ano: int = Query(...),
):
    _check_admin(authorization)
    conn = get_db()
    rows = conn.execute(
        "SELECT id, cd_secao, meta_eans FROM ponderada_meta WHERE mes=? AND ano=?",
        (mes, ano),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/admin/metas")
def upsert_meta(meta: MetaInput, authorization: str = Header(None)):
    _check_admin(authorization)
    conn = get_db()
    conn.execute(
        """
        INSERT INTO ponderada_meta (cd_secao, mes, ano, meta_eans)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(cd_secao, mes, ano) DO UPDATE SET meta_eans=excluded.meta_eans
        """,
        (meta.cd_secao, meta.mes, meta.ano, meta.meta_eans),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/admin/metas")
def delete_meta(
    authorization: str = Header(None),
    cd_secao: str = Query(...),
    mes: int = Query(...),
    ano: int = Query(...),
):
    _check_admin(authorization)
    conn = get_db()
    conn.execute(
        "DELETE FROM ponderada_meta WHERE cd_secao=? AND mes=? AND ano=?",
        (cd_secao, mes, ano),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Senhas de clientes ─────────────────────────────────────────────────────────

class SenhaInput(BaseModel):
    cnpj_raiz: str
    senha: str


@router.get("/admin/senhas")
def list_senhas(authorization: str = Header(None)):
    _check_admin(authorization)
    conn = get_db()
    rows = conn.execute(
        "SELECT cnpj_raiz, criado_em FROM client_passwords ORDER BY criado_em DESC"
    ).fetchall()
    conn.close()
    return [{"cnpj_raiz": r["cnpj_raiz"], "criado_em": r["criado_em"]} for r in rows]


@router.post("/admin/senhas")
def set_senha(body: SenhaInput, authorization: str = Header(None)):
    _check_admin(authorization)
    if len(body.senha) < 4:
        raise HTTPException(status_code=400, detail="Senha deve ter no mínimo 4 caracteres")
    conn = get_db()
    conn.execute(
        """INSERT INTO client_passwords (cnpj_raiz, senha_hash)
           VALUES (?, ?)
           ON CONFLICT(cnpj_raiz) DO UPDATE SET senha_hash=excluded.senha_hash, criado_em=datetime('now')""",
        (body.cnpj_raiz, _hash(body.senha)),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/admin/senhas")
def delete_senha(authorization: str = Header(None), cnpj_raiz: str = Query(...)):
    _check_admin(authorization)
    conn = get_db()
    conn.execute("DELETE FROM client_passwords WHERE cnpj_raiz=?", (cnpj_raiz,))
    conn.commit()
    conn.close()
    return {"ok": True}
