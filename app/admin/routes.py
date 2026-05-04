import json

import psycopg2
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.auth.tokens import create_token
from app.admin.service import (
    authenticate_user,
    list_usuarios, upsert_usuario, desativar_usuario,
    list_igrejas,  upsert_igreja,  desativar_igreja,
    list_vinculos, upsert_vinculo, desativar_vinculo,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Login / refresh
# ---------------------------------------------------------------------------

@router.post("/api/login")
async def api_login(request: Request):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"message": "JSON invalido."})

    email = str(payload.get("email") or payload.get("usuario") or "").strip()
    senha = str(payload.get("senha") or "")

    if not email or not senha:
        return JSONResponse(status_code=400, content={"message": "E-mail e senha sao obrigatorios."})

    try:
        user = authenticate_user(email, senha)
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

    if not user:
        return JSONResponse(status_code=401, content={"message": "E-mail ou senha invalidos."})

    return {
        "message":     f"Bem-vindo, {user['nome']}.",
        "id":          user["id"],
        "nome":        user["nome"],
        "email":       user["email"],
        "nivel":       user["nivel"],
        "foto_url":    user["foto_url"],
        "igreja_id":   user["igreja_id"],
        "igreja_nome": user["igreja_nome"],
        "igrejas":     user["igrejas"],
        "token":       create_token(user["id"], user["nivel"]),
        # aliases legados usados pelo shell.js
        "usuario":     user["nome"],
        "sistema":     user["nivel"],
        "empresa_id":  user["igreja_id"],
        "empresa_nome": user["igreja_nome"],
        "empresas":    [{"id": i["id"], "nome": i["nome"]} for i in user["igrejas"]],
    }


@router.post("/api/auth/recuperar-senha")
async def api_recuperar_senha(request: Request):
    """Gera senha temporária e envia por e-mail (Hostinger SMTP)."""
    import logging
    import random
    import string

    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"message": "JSON invalido."})

    email = str(payload.get("email") or "").strip().lower()
    if not email:
        return JSONResponse(status_code=400, content={"message": "E-mail obrigatorio."})

    from app.config.settings import smtp_configured
    from app.auth.tokens import hash_senha

    # Busca o usuário — resposta sempre igual para não revelar se e-mail existe
    MSG_OK = "Se este e-mail estiver cadastrado, você receberá a senha temporária em instantes."

    try:
        from app.database.connection import get_db_connection
        from psycopg2.extras import RealDictCursor
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, nome FROM usuarios WHERE email = %s AND ativo = TRUE",
                    (email,)
                )
                user = cur.fetchone()

        if not user:
            return {"message": MSG_OK}

        # Gera senha temporária: 8 chars (letras + dígitos)
        chars = string.ascii_letters + string.digits
        senha_temp = "".join(random.choices(chars, k=8))

        # Salva hash da senha temporária
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE usuarios SET senha_hash = %s WHERE id = %s",
                    (hash_senha(senha_temp), user["id"])
                )
            conn.commit()

        # Envia e-mail se SMTP configurado
        if smtp_configured():
            from app.utils.email import send_email, template_recuperar_senha
            html = template_recuperar_senha(user["nome"], senha_temp)
            send_email(email, "Recuperação de senha — Visão Célula", html)
        else:
            # Sem SMTP: loga senha temporária para o admin ver
            logging.getLogger("visao_celula").warning(
                "SMTP nao configurado. Senha temp para %s (%s): %s",
                user["nome"], email, senha_temp
            )

    except Exception as e:
        logging.getLogger("visao_celula").error("Erro em recuperar-senha: %s", e)
        return JSONResponse(status_code=500, content={"message": "Erro ao processar solicitacao."})

    return {"message": MSG_OK}


@router.post("/api/auth/refresh")
async def api_auth_refresh(request: Request):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"message": "JSON invalido."})

    user_id = payload.get("id")
    if not user_id:
        return JSONResponse(status_code=400, content={"message": "ID requerido."})

    try:
        with __import__("app.database.connection", fromlist=["get_db_connection"]).get_db_connection() as conn:
            from psycopg2.extras import RealDictCursor
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT v.igreja_id, i.nome AS igreja_nome,
                           COALESCE(v.nivel::text, u.nivel::text) AS nivel
                    FROM vinculos_usuario_igreja v
                    JOIN igrejas  i ON i.id = v.igreja_id
                    JOIN usuarios u ON u.id = v.usuario_id
                    WHERE v.usuario_id = %s AND v.ativo = TRUE AND i.ativo = TRUE
                    ORDER BY i.nome
                    """,
                    (int(user_id),),
                )
                igrejas = [
                    {"id": r["igreja_id"], "nome": r["igreja_nome"]}
                    for r in cur.fetchall()
                ]
                cur.execute("SELECT nivel FROM usuarios WHERE id = %s", (int(user_id),))
                row = cur.fetchone()
                nivel = row["nivel"] if row else "observer"
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

    return {
        "igreja_id":   igrejas[0]["id"]   if igrejas else None,
        "igreja_nome": igrejas[0]["nome"] if igrejas else None,
        "igrejas":     igrejas,
        "empresa_id":  igrejas[0]["id"]   if igrejas else None,
        "empresa_nome": igrejas[0]["nome"] if igrejas else None,
        "empresas":    igrejas,
        "token":       create_token(int(user_id), nivel),
    }


# ---------------------------------------------------------------------------
# Usuários
# ---------------------------------------------------------------------------

@router.get("/api/admin/usuarios")
def api_admin_usuarios():
    try:
        return {"items": list_usuarios()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("/api/admin/usuarios")
async def api_admin_usuario_salvar(request: Request):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"message": "JSON invalido."})
    try:
        result = upsert_usuario(payload)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except psycopg2.IntegrityError:
        return JSONResponse(status_code=409, content={"message": "E-mail ja cadastrado."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
    return {"message": "Usuario salvo com sucesso.", **result}


@router.patch("/api/admin/usuarios/{uid}/desativar")
def api_admin_usuario_desativar(uid: int):
    try:
        desativar_usuario(uid)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
    return {"message": "Usuario desativado com sucesso."}


# ---------------------------------------------------------------------------
# Igrejas
# ---------------------------------------------------------------------------

@router.get("/api/admin/igrejas")
def api_admin_igrejas():
    try:
        return {"items": list_igrejas()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("/api/admin/igrejas")
async def api_admin_igreja_salvar(request: Request):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"message": "JSON invalido."})
    try:
        result = upsert_igreja(payload)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
    return {"message": "Igreja salva com sucesso.", **result}


@router.patch("/api/admin/igrejas/{iid}/desativar")
def api_admin_igreja_desativar(iid: int):
    try:
        desativar_igreja(iid)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
    return {"message": "Igreja desativada com sucesso."}


# ---------------------------------------------------------------------------
# Vínculos
# ---------------------------------------------------------------------------

@router.get("/api/admin/vinculos")
def api_admin_vinculos():
    try:
        return {"items": list_vinculos()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("/api/admin/vinculos")
async def api_admin_vinculo_salvar(request: Request):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"message": "JSON invalido."})
    try:
        result = upsert_vinculo(payload)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except psycopg2.IntegrityError:
        return JSONResponse(status_code=409, content={"message": "Vinculo ja cadastrado."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
    return {"message": "Vinculo salvo com sucesso.", **result}


@router.patch("/api/admin/vinculos/{vid}/desativar")
def api_admin_vinculo_desativar(vid: int):
    try:
        desativar_vinculo(vid)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
    return {"message": "Vinculo desativado com sucesso."}
