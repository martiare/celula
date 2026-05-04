from fastapi import Request
from fastapi.responses import JSONResponse

from app.auth.tokens import verify_token

_AUTH_PREFIXES = (
    "/api/admin/", "/api/celula/", "/api/perfil",
    "/api/grupos-pastor", "/api/ministerios", "/api/pastores",
    "/api/discipulos", "/api/dashboard",
    "/api/minha-igreja", "/api/celulas/",
)


async def auth_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    path = request.url.path
    needs_auth = any(path.startswith(p) for p in _AUTH_PREFIXES)
    if needs_auth:
        raw = request.headers.get("authorization", "")
        token = raw[7:].strip() if raw.startswith("Bearer ") else ""
        payload = verify_token(token) if token else None
        if not payload:
            return JSONResponse(status_code=401, content={"message": "Nao autorizado."})
        # Rotas admin exigem nível administrador
        if path.startswith("/api/admin/") and payload["nivel"] != "administrador":
            return JSONResponse(status_code=403, content={"message": "Acesso restrito ao administrador."})
        request.state.user_id = payload["user_id"]
        request.state.nivel   = payload["nivel"]
    return await call_next(request)
