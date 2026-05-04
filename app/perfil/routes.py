import json

import psycopg2
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from psycopg2.extras import RealDictCursor

from app.config.settings import FOTOS_DIR
from app.database.connection import get_db_connection
from app.auth.tokens import hash_senha

router = APIRouter()


@router.get("/api/perfil")
def api_get_perfil(request: Request):
    user_id = request.state.user_id
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, nome, email, foto_url, nivel FROM usuarios WHERE id = %s AND ativo = TRUE",
                    (user_id,),
                )
                row = cur.fetchone()
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

    if not row:
        return JSONResponse(status_code=404, content={"message": "Usuario nao encontrado."})

    result = dict(row)
    if not result.get("foto_url"):
        for ext in ("jpg", "png", "webp"):
            if (FOTOS_DIR / f"{user_id}.{ext}").exists():
                result["foto_url"] = f"/assets/fotos/{user_id}.{ext}"
                break

    result["usuario"] = result.get("nome", "")
    return result


@router.post("/api/perfil")
async def api_update_perfil(request: Request):
    user_id = request.state.user_id
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"message": "JSON invalido."})

    nome  = (payload.get("nome") or payload.get("usuario") or "").strip()[:100]
    email = (payload.get("email") or "").strip()[:100]
    senha = (payload.get("senha") or "").strip()

    if not nome:
        return JSONResponse(status_code=400, content={"message": "Nome obrigatorio."})

    set_parts = ["nome = %s", "email = %s"]
    values: list = [nome, email]

    if senha:
        set_parts.append("senha_hash = %s")
        values.append(hash_senha(senha))

    values.append(int(user_id))
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"UPDATE usuarios SET {', '.join(set_parts)} WHERE id = %s RETURNING id, nome, email",
                    tuple(values),
                )
                row = cur.fetchone()
                if not row:
                    return JSONResponse(status_code=404, content={"message": "Usuario nao encontrado."})
            conn.commit()
    except psycopg2.Error as e:
        return JSONResponse(status_code=500, content={"message": f"Erro ao salvar perfil: {e}"})

    return {"message": "Perfil atualizado.", "nome": row["nome"], "usuario": row["nome"], "email": row["email"]}


@router.post("/api/perfil/foto")
async def api_update_foto(request: Request):
    user_id = request.state.user_id
    form = await request.form()
    file_obj = form.get("foto")

    if not file_obj:
        return JSONResponse(status_code=400, content={"message": "foto obrigatoria."})

    FOTOS_DIR.mkdir(parents=True, exist_ok=True)
    file_bytes = await file_obj.read()
    mime = (file_obj.content_type or "image/jpeg").split(";")[0].strip()
    ext = "png" if "png" in mime else ("webp" if "webp" in mime else "jpg")

    for old_ext in ("jpg", "png", "webp"):
        old = FOTOS_DIR / f"{user_id}.{old_ext}"
        if old.exists():
            old.unlink()

    foto_path = FOTOS_DIR / f"{user_id}.{ext}"
    foto_path.write_bytes(file_bytes)
    foto_url = f"/assets/fotos/{user_id}.{ext}"

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE usuarios SET foto_url = %s WHERE id = %s",
                    (foto_url, int(user_id)),
                )
            conn.commit()
    except psycopg2.Error:
        pass

    return {"foto_url": foto_url}
