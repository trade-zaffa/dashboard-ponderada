from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from routers.metas import get_db, _check_admin

router = APIRouter()


def _init_table():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sortimento_ean (
            ean       TEXT PRIMARY KEY,
            criado_em TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()


_init_table()


class EansInput(BaseModel):
    eans: list[str]


@router.get("/admin/sortimento-eans")
def list_sortimento_eans(authorization: str = Header(None)):
    _check_admin(authorization)
    conn = get_db()
    rows = conn.execute("SELECT ean, criado_em FROM sortimento_ean ORDER BY criado_em DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/admin/sortimento-eans")
def add_sortimento_eans(body: EansInput, authorization: str = Header(None)):
    _check_admin(authorization)
    eans = [e.strip() for e in body.eans if e.strip()]
    if not eans:
        raise HTTPException(status_code=400, detail="Nenhum EAN informado")
    conn = get_db()
    conn.executemany(
        "INSERT OR IGNORE INTO sortimento_ean (ean) VALUES (?)",
        [(e,) for e in eans],
    )
    conn.commit()
    conn.close()
    return {"ok": True, "inseridos": len(eans)}


@router.delete("/admin/sortimento-eans/{ean}")
def delete_sortimento_ean(ean: str, authorization: str = Header(None)):
    _check_admin(authorization)
    conn = get_db()
    conn.execute("DELETE FROM sortimento_ean WHERE ean=?", (ean,))
    conn.commit()
    conn.close()
    return {"ok": True}
