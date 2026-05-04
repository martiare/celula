import base64
import hashlib
import hmac
import time

from app.config.settings import get_app_secret_key

_TOKEN_TTL = 8 * 3600  # 8 horas


def hash_senha(senha: str) -> str:
    """SHA-256 hex — usado no cadastro e na autenticação."""
    return hashlib.sha256(senha.encode()).hexdigest()


def create_token(user_id: int, nivel: str = "observer") -> str:
    expires = int(time.time()) + _TOKEN_TTL
    payload = f"{user_id}:{nivel}:{expires}"
    sig = hmac.new(get_app_secret_key().encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}.{sig}".encode()).decode()


def verify_token(token: str) -> dict | None:
    """Retorna {"user_id": int, "nivel": str} ou None se inválido/expirado."""
    try:
        decoded = base64.urlsafe_b64decode(token.encode() + b"==").decode()
        payload, sig = decoded.rsplit(".", 1)
        expected = hmac.new(get_app_secret_key().encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        parts = payload.split(":", 2)
        if len(parts) != 3:
            return None
        user_id_str, nivel, expires_str = parts
        if int(expires_str) < int(time.time()):
            return None
        return {"user_id": int(user_id_str), "nivel": nivel}
    except Exception:
        return None
