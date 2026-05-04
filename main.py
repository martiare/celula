"""
Visão Célula — ponto de entrada da aplicação modular.
Versão: v1.0.0.1 · 27/04/2026
"""
import site
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
VENDOR_DIR = BASE_DIR / ".vendor"
USER_SITE_DIR = Path(site.getusersitepackages())


def _ensure_deps() -> None:
    for candidate in (USER_SITE_DIR, VENDOR_DIR):
        if candidate.exists():
            candidate_str = str(candidate)
            if candidate_str not in sys.path:
                sys.path.insert(0, candidate_str)


_ensure_deps()

try:
    import uvicorn
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles
except ImportError as e:
    raise SystemExit(
        f"Dependencia ausente: {e.name}. "
        "Execute 'python -m pip install -r requirements.txt'."
    ) from e

from contextlib import asynccontextmanager
import asyncio

from app.config.settings import (
    load_env_file,
    get_http_origins,
    get_app_host,
    get_app_port,
    INDEX_FILE,
    DASHBOARD_FILE,
    LOGO_FILE,
    ASSETS_DIR,
    PAGES_DIR,
)
from app.auth.middleware import auth_middleware
from app.admin.routes import router as admin_router
from app.perfil.routes import router as perfil_router
from app.cadastros.routes import router as cadastros_router

load_env_file()


async def _warmup_db(max_attempts: int = 10, delay: float = 2.0) -> None:
    """Testa a conexão ao banco na subida; retenta até max_attempts vezes."""
    from app.database.connection import get_db_connection
    import psycopg2
    for attempt in range(1, max_attempts + 1):
        try:
            with get_db_connection() as conn:
                conn.cursor().execute("SELECT 1")
            return
        except (psycopg2.OperationalError, psycopg2.InterfaceError, Exception):
            if attempt < max_attempts:
                await asyncio.sleep(delay)


def _auto_migrate() -> None:
    """Aplica migrações SQL pendentes em ordem, registrando em schema_migrations."""
    try:
        from app.database.connection import get_db_connection
        migrations_dir = BASE_DIR / "migrations"
        if not migrations_dir.exists():
            return
        sql_files = sorted(migrations_dir.glob("*.sql"))
        if not sql_files:
            return
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        filename TEXT PRIMARY KEY,
                        applied_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                cur.execute("SELECT filename FROM schema_migrations")
                applied = {r[0] for r in cur.fetchall()}
            conn.commit()
            for sql_file in sql_files:
                if sql_file.name in applied:
                    continue
                sql = sql_file.read_text(encoding="utf-8")
                with conn.cursor() as cur:
                    cur.execute(sql)
                    cur.execute(
                        "INSERT INTO schema_migrations (filename) VALUES (%s)",
                        (sql_file.name,),
                    )
                conn.commit()
    except Exception:
        pass


@asynccontextmanager
async def lifespan(application: FastAPI):
    await _warmup_db()
    _auto_migrate()
    yield


app = FastAPI(title="Visao Celula API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_http_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(auth_middleware)


@app.middleware("http")
async def _no_cache_assets(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/assets/") or path in ("/", "/index.html", "/dashboard", "/dashboard.html"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

if PAGES_DIR.exists():
    app.mount("/pages", StaticFiles(directory=PAGES_DIR), name="pages")

app.include_router(admin_router)
app.include_router(perfil_router)
app.include_router(cadastros_router)

_NO_CACHE = {"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"}


def _html(path):
    return FileResponse(path, media_type="text/html; charset=utf-8", headers=_NO_CACHE)


@app.get("/", include_in_schema=False)
def serve_home():
    return _html(INDEX_FILE)


@app.get("/index.html", include_in_schema=False)
def serve_index():
    return _html(INDEX_FILE)


@app.get("/dashboard", include_in_schema=False)
def serve_dashboard():
    return _html(DASHBOARD_FILE)


@app.get("/dashboard.html", include_in_schema=False)
def serve_dashboard_html():
    return _html(DASHBOARD_FILE)


@app.get("/dashboard/{path:path}", include_in_schema=False)
def serve_dashboard_path(path: str):
    return _html(DASHBOARD_FILE)


@app.get("/favicon.ico", include_in_schema=False)
def serve_favicon():
    return FileResponse(LOGO_FILE)


@app.get("/healthz")
def healthcheck():
    return {"status": "ok", "app": "Visao Celula", "version": "v1.0.0.1"}


def main():
    uvicorn.run(
        app,
        host=get_app_host(),
        port=get_app_port(),
        log_level="warning",
        access_log=False,
    )


if __name__ == "__main__":
    main()
