import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

INDEX_FILE     = BASE_DIR / "index.html"
DASHBOARD_FILE = BASE_DIR / "dashboard.html"
LOGO_FILE      = BASE_DIR / "favicon.ico"
ASSETS_DIR     = BASE_DIR / "assets"
PAGES_DIR      = BASE_DIR / "pages"
FOTOS_DIR      = BASE_DIR / "assets" / "fotos"


class MissingConfigError(RuntimeError):
    pass


def load_env_file() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def get_env(name: str, default: str | None = None) -> str:
    file_path = os.getenv(f"{name}_FILE", "").strip()
    if file_path:
        try:
            value = Path(file_path).read_text(encoding="utf-8").strip()
        except OSError as error:
            raise MissingConfigError(f"Nao foi possivel ler {name}_FILE: {error}") from error
        if value:
            return value
    value = os.getenv(name, "").strip()
    if value:
        return value
    if default is not None:
        return default
    raise MissingConfigError(f"Variavel {name} nao configurada.")


def get_optional_env(name: str, default: str) -> str:
    return get_env(name, default=default)


def get_app_secret_key() -> str:
    return get_optional_env("APP_SECRET_KEY", "visao_celula_inseguro_troque_em_producao")


def get_http_origins() -> list[str]:
    raw_value = get_optional_env("ALLOWED_ORIGIN", "*")
    if raw_value == "*":
        return ["*"]
    origins = [o.strip() for o in raw_value.split(",") if o.strip()]
    return origins or ["*"]


def get_app_host() -> str:
    return get_optional_env("APP_HOST", "127.0.0.1")


def get_app_port() -> int:
    return int(get_optional_env("APP_PORT", "8000"))


def get_db_connect_timeout() -> int:
    return int(get_optional_env("PGCONNECT_TIMEOUT", "5"))


def get_db_sslmode() -> str:
    return get_optional_env("PGSSLMODE", "prefer")


# ── SMTP (Hostinger / qualquer servidor) ──────────────────────────────────────

def get_smtp_host() -> str:
    return get_optional_env("SMTP_HOST", "smtp.hostinger.com")

def get_smtp_port() -> int:
    return int(get_optional_env("SMTP_PORT", "587"))

def get_smtp_user() -> str:
    return get_optional_env("SMTP_USER", "")

def get_smtp_pass() -> str:
    return get_env("SMTP_PASS", default="")

def get_smtp_from() -> str:
    return get_optional_env("SMTP_FROM", get_smtp_user())

def smtp_configured() -> bool:
    return bool(get_smtp_user())
