import pyodbc
import os
from dotenv import load_dotenv

def get_connection():
    load_dotenv(override=True)
    conn_str = (
        f"DRIVER={{{os.getenv('MOINHO_DB_DRIVER')}}};"
        f"SERVER={os.getenv('MOINHO_DB_SERVER')};"
        f"DATABASE={os.getenv('MOINHO_DB_NAME')};"
        f"UID={os.getenv('MOINHO_DB_USER')};"
        f"PWD={os.getenv('MOINHO_DB_PASSWORD')};"
        f"TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)
