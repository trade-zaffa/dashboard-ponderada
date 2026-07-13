from routers.metas import get_db


def get_incluir_avista() -> bool:
    """Flag global: quando False (padrao), exclui pedidos com prazo
    'A VISTA - (4 DIAS)' de qualquer calculo de faturamento/sortimento."""
    db = get_db()
    row = db.execute("SELECT valor FROM programa_config WHERE chave='incluir_avista'").fetchone()
    db.close()
    return bool(row) and row["valor"] == "1"


def set_incluir_avista(valor: bool):
    db = get_db()
    db.execute(
        """INSERT INTO programa_config (chave, valor) VALUES ('incluir_avista', ?)
           ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor""",
        ("1" if valor else "0",),
    )
    db.commit()
    db.close()


def filtro_avista(incluir: bool, alias_pv: str = "pv", alias_pr: str = "pr") -> str:
    """SQL a acrescentar no WHERE. Requer LEFT JOIN promocao {alias_pr} ON {alias_pr}.seq_prom = {alias_pv}.seq_prom."""
    if incluir:
        return ""
    return f"AND ({alias_pr}.descricao IS NULL OR {alias_pr}.descricao <> 'A VISTA - (4 DIAS)')"


def init_programa_config_table():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS programa_config (
            chave TEXT PRIMARY KEY,
            valor TEXT NOT NULL
        )
    """)
    db.commit()
    db.close()


init_programa_config_table()
