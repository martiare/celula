import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, FileResponse

from app.cadastros.service import (
    get_dashboard_stats,
    get_igreja_detalhes, update_igreja_foto,
    search_celulas,
    list_grupos_pastor, upsert_grupo_pastor, excluir_grupo_pastor,
    list_ministerios,   upsert_ministerio,   excluir_ministerio,
    list_pastores,      upsert_pastor,        desativar_pastor,      get_pastor,
    save_pastor_foto,   get_pastor_foto_path,
    list_membros,       upsert_membro,        desativar_membro,      get_membro,
    save_membro_foto,   get_membro_foto_path,
    list_macrocelulas, upsert_macrocelula, excluir_macrocelula, get_macrocelula,
    list_tipos_celula, upsert_tipo_celula, excluir_tipo_celula,
    list_celulas,      upsert_celula,      desativar_celula,     get_celula,
)

router = APIRouter()


def _igr(request: Request) -> int:
    """Igreja ativa vem do header X-Igreja-Id ou query param."""
    raw = request.headers.get("X-Igreja-Id", "") or request.query_params.get("igreja_id", "")
    try:
        return int(raw)
    except (ValueError, TypeError):
        return 0


def _require_igreja(request: Request):
    iid = _igr(request)
    if not iid:
        raise ValueError("igreja_id obrigatório.")
    return iid


# ---------------------------------------------------------------------------
# Igreja (dados da igreja ativa — qualquer usuário autenticado)
# ---------------------------------------------------------------------------

@router.get("/api/minha-igreja")
def api_minha_igreja(request: Request):
    try:
        iid = _require_igreja(request)
        row = get_igreja_detalhes(iid)
        if not row:
            return JSONResponse(status_code=404, content={"message": "Igreja não encontrada."})
        return row
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("/api/minha-igreja/foto")
async def api_minha_igreja_foto(request: Request):
    from app.config.settings import ASSETS_DIR
    iid = _igr(request)
    if not iid:
        return JSONResponse(status_code=400, content={"message": "igreja_id obrigatório."})
    form = await request.form()
    file_obj = form.get("foto")
    if not file_obj:
        return JSONResponse(status_code=400, content={"message": "foto obrigatória."})
    mime = (file_obj.content_type or "image/jpeg").split(";")[0].strip()
    ext = "png" if "png" in mime else ("webp" if "webp" in mime else "jpg")
    folder = ASSETS_DIR / "fotos" / "igrejas"
    folder.mkdir(parents=True, exist_ok=True)
    for old_ext in ("jpg", "png", "webp"):
        old = folder / f"{iid}.{old_ext}"
        if old.exists():
            old.unlink()
    foto_path = folder / f"{iid}.{ext}"
    foto_path.write_bytes(await file_obj.read())
    foto_url = f"/assets/fotos/igrejas/{iid}.{ext}"
    try:
        update_igreja_foto(iid, foto_url)
    except Exception:
        pass
    return {"foto_url": foto_url}


# ---------------------------------------------------------------------------
# Células (busca para autocomplete no discípulo)
# ---------------------------------------------------------------------------

@router.get("/api/celulas/busca")
def api_celulas_busca(request: Request):
    try:
        iid = _require_igreja(request)
        q = request.query_params.get("q", "").strip()
        return {"items": search_celulas(iid, q)}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/api/dashboard/stats")
def api_dashboard_stats(request: Request):
    try:
        iid = _require_igreja(request)
        return get_dashboard_stats(iid)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


# ---------------------------------------------------------------------------
# Grupos de pastor
# ---------------------------------------------------------------------------

@router.get("/api/grupos-pastor")
def api_list_grupos(request: Request):
    try:
        return {"items": list_grupos_pastor(_require_igreja(request))}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("/api/grupos-pastor")
async def api_save_grupo(request: Request):
    try:
        payload = await request.json()
        iid = _require_igreja(request)
        result = upsert_grupo_pastor(payload, iid)
        return {"message": "Grupo de pastor salvo.", **result}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.delete("/api/grupos-pastor/{gid}")
def api_excluir_grupo(gid: int, request: Request):
    try:
        excluir_grupo_pastor(gid, _require_igreja(request))
        return {"message": "Grupo de pastor excluído."}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


# ---------------------------------------------------------------------------
# Ministérios
# ---------------------------------------------------------------------------

@router.get("/api/ministerios")
def api_list_ministerios(request: Request):
    try:
        return {"items": list_ministerios(_require_igreja(request))}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("/api/ministerios")
async def api_save_ministerio(request: Request):
    try:
        payload = await request.json()
        iid = _require_igreja(request)
        result = upsert_ministerio(payload, iid)
        return {"message": "Ministério salvo.", **result}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.delete("/api/ministerios/{mid}")
def api_excluir_ministerio(mid: int, request: Request):
    try:
        excluir_ministerio(mid, _require_igreja(request))
        return {"message": "Ministério excluído."}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


# ---------------------------------------------------------------------------
# Pastores
# ---------------------------------------------------------------------------

@router.get("/api/pastores")
def api_list_pastores(request: Request):
    try:
        return {"items": list_pastores(_require_igreja(request))}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.get("/api/pastores/{pid}")
def api_get_pastor(pid: int, request: Request):
    try:
        row = get_pastor(pid, _require_igreja(request))
        if not row:
            return JSONResponse(status_code=404, content={"message": "Pastor não encontrado."})
        return row
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("/api/pastores")
async def api_save_pastor(request: Request):
    try:
        payload = await request.json()
        iid = _require_igreja(request)
        result = upsert_pastor(payload, iid)
        return {"message": "Pastor salvo.", **result}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.patch("/api/pastores/{pid}/desativar")
def api_desativar_pastor(pid: int, request: Request):
    try:
        desativar_pastor(pid, _require_igreja(request))
        return {"message": "Pastor desativado."}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


# ---------------------------------------------------------------------------
# Foto de pastor (isolada por igreja)
# ---------------------------------------------------------------------------

@router.post("/api/pastores/{pid}/foto")
async def api_pastor_foto_upload(pid: int, request: Request):
    iid = _igr(request)
    if not iid:
        return JSONResponse(status_code=400, content={"message": "igreja_id obrigatório."})
    form = await request.form()
    file_obj = form.get("foto")
    if not file_obj:
        return JSONResponse(status_code=400, content={"message": "foto obrigatória."})
    mime = (file_obj.content_type or "image/jpeg").split(";")[0].strip()
    file_bytes = await file_obj.read()
    try:
        foto_url = save_pastor_foto(pid, iid, file_bytes, mime)
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
    return {"foto_url": foto_url}


@router.get("/api/pastores/{pid}/foto")
def api_pastor_foto_serve(pid: int, request: Request):
    iid = _igr(request)
    if not iid:
        return JSONResponse(status_code=400, content={"message": "igreja_id obrigatório."})
    path = get_pastor_foto_path(pid, iid)
    if not path:
        return JSONResponse(status_code=404, content={"message": "Foto não encontrada."})
    suffix = path.suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    return FileResponse(path, media_type=mime_map.get(suffix, "image/jpeg"))


# ---------------------------------------------------------------------------
# Discípulos (membros)
# ---------------------------------------------------------------------------

@router.get("/api/discipulos")
def api_list_discipulos(request: Request):
    try:
        return {"items": list_membros(_require_igreja(request))}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.get("/api/discipulos/{mid}")
def api_get_discipulo(mid: int, request: Request):
    try:
        row = get_membro(mid, _require_igreja(request))
        if not row:
            return JSONResponse(status_code=404, content={"message": "Discípulo não encontrado."})
        return row
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.post("/api/discipulos")
async def api_save_discipulo(request: Request):
    try:
        payload = await request.json()
        iid = _require_igreja(request)
        result = upsert_membro(payload, iid)
        return {"message": "Discípulo salvo.", **result}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.patch("/api/discipulos/{mid}/desativar")
def api_desativar_discipulo(mid: int, request: Request):
    try:
        desativar_membro(mid, _require_igreja(request))
        return {"message": "Discípulo desativado."}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


# ---------------------------------------------------------------------------
# Foto de discípulo (isolada por igreja)
# ---------------------------------------------------------------------------

@router.post("/api/discipulos/{mid}/foto")
async def api_discipulo_foto_upload(mid: int, request: Request):
    iid = _igr(request)
    if not iid:
        return JSONResponse(status_code=400, content={"message": "igreja_id obrigatório."})
    form = await request.form()
    file_obj = form.get("foto")
    if not file_obj:
        return JSONResponse(status_code=400, content={"message": "foto obrigatória."})
    mime = (file_obj.content_type or "image/jpeg").split(";")[0].strip()
    file_bytes = await file_obj.read()
    try:
        foto_url = save_membro_foto(mid, iid, file_bytes, mime)
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
    return {"foto_url": foto_url}


@router.get("/api/discipulos/{mid}/foto")
def api_discipulo_foto_serve(mid: int, request: Request):
    """Serve a foto com verificação de isolamento por igreja."""
    iid = _igr(request)
    if not iid:
        return JSONResponse(status_code=400, content={"message": "igreja_id obrigatório."})
    path = get_membro_foto_path(mid, iid)
    if not path:
        return JSONResponse(status_code=404, content={"message": "Foto não encontrada."})
    suffix = path.suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    return FileResponse(path, media_type=mime_map.get(suffix, "image/jpeg"))


# Macrocélulas
@router.get("/api/macrocelulas")
def api_list_macrocelulas(request: Request):
    try:
        return {"items": list_macrocelulas(_require_igreja(request))}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})


@router.get("/api/macrocelulas/{mid}")
def api_get_macrocelula(mid: int, request: Request):
    try:
        row = get_macrocelula(mid, _require_igreja(request))
        if not row:
            return JSONResponse(status_code=404, content={"message": "Macrocélula não encontrada."})
        return row
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@router.post("/api/macrocelulas")
async def api_save_macrocelula(request: Request):
    try:
        payload = await request.json()
        result = upsert_macrocelula(payload, _require_igreja(request))
        return {"message": "Macrocélula salva.", **result}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@router.delete("/api/macrocelulas/{mid}")
def api_excluir_macrocelula(mid: int, request: Request):
    try:
        excluir_macrocelula(mid, _require_igreja(request))
        return {"message": "Macrocélula excluída."}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

# Tipos de célula
@router.get("/api/tipos-celula")
def api_list_tipos_celula(request: Request):
    try:
        return {"items": list_tipos_celula(_require_igreja(request))}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@router.post("/api/tipos-celula")
async def api_save_tipo_celula(request: Request):
    try:
        payload = await request.json()
        result = upsert_tipo_celula(payload, _require_igreja(request))
        return {"message": "Tipo de célula salvo.", **result}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@router.delete("/api/tipos-celula/{tid}")
def api_excluir_tipo_celula(tid: int, request: Request):
    try:
        excluir_tipo_celula(tid, _require_igreja(request))
        return {"message": "Tipo de célula excluído."}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

# Células
@router.get("/api/celulas")
def api_list_celulas(request: Request):
    try:
        return {"items": list_celulas(_require_igreja(request))}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@router.get("/api/celulas/{cid}")
def api_get_celula(cid: int, request: Request):
    try:
        row = get_celula(cid, _require_igreja(request))
        if not row:
            return JSONResponse(status_code=404, content={"message": "Célula não encontrada."})
        return row
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@router.post("/api/celulas")
async def api_save_celula(request: Request):
    try:
        payload = await request.json()
        result = upsert_celula(payload, _require_igreja(request))
        return {"message": "Célula salva.", **result}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@router.patch("/api/celulas/{cid}/desativar")
def api_desativar_celula(cid: int, request: Request):
    try:
        desativar_celula(cid, _require_igreja(request))
        return {"message": "Célula desativada."}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"message": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})
