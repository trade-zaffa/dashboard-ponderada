import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env', override=True)
from routers import auth, sortimento, faturamento, admin, pedidos, metas, programa

app = FastAPI(title="Dashboard Ponderada", version="1.0.0")

_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(sortimento.router, prefix="/api", tags=["sortimento"])
app.include_router(faturamento.router, prefix="/api", tags=["faturamento"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(pedidos.router, prefix="/api", tags=["pedidos"])
app.include_router(metas.router, prefix="/api", tags=["metas"])
app.include_router(programa.router, prefix="/api", tags=["programa"])

@app.get("/")
def root():
    return {"status": "ok", "app": "Dashboard Ponderada"}
