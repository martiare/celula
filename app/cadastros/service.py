import os
from pathlib import Path

from psycopg2.extras import RealDictCursor
from app.database.connection import get_db_connection
from app.config.settings import ASSETS_DIR

FOTOS_DISC_DIR   = ASSETS_DIR / "fotos" / "disc"
FOTOS_PASTOR_DIR = ASSETS_DIR / "fotos" / "pastor"


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _run(sql, params=()):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        conn.commit()
    return list(rows)


def _one(sql, params=()):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
        conn.commit()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Igreja (dados da igreja ativa)
# ---------------------------------------------------------------------------

def get_igreja_detalhes(iid: int) -> dict | None:
    return _one(
        "SELECT id,nome,razao_social,cnpj,endereco,numero,bairro,cidade,uf,cep,"
        "telefone,email,foto_url,data_fundacao,ativo FROM igrejas WHERE id=%s",
        (iid,),
    )


def update_igreja_foto(iid: int, foto_url: str) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE igrejas SET foto_url=%s WHERE id=%s", (foto_url, iid))
        conn.commit()


# ---------------------------------------------------------------------------
# Células (para autocomplete no discípulo)
# ---------------------------------------------------------------------------

def search_celulas(igreja_id: int, q: str = '') -> list[dict]:
    like = f"%{q}%" if q else "%"
    return _run(
        """
        SELECT c.id, c.nome, c.dia_semana, c.hora,
               COALESCE(u.nome, '') AS lider_nome,
               COALESCE(mc.nome,  '') AS macrocelula_nome,
               mc.id AS macrocelula_id
        FROM   celulas c
        LEFT   JOIN usuarios    u  ON u.id  = c.lider_id
        LEFT   JOIN macrocelulas mc ON mc.id = c.macrocelula_id
        WHERE  c.igreja_id = %s AND c.ativo = TRUE
          AND  (c.nome ILIKE %s OR c.id::text ILIKE %s)
        ORDER  BY c.nome
        LIMIT  30
        """,
        (igreja_id, like, like),
    )


# ---------------------------------------------------------------------------
# Foto de discípulo (isolada por igreja)
# ---------------------------------------------------------------------------

def save_membro_foto(mid: int, igreja_id: int, file_bytes: bytes, mime: str) -> str:
    """Salva foto em assets/fotos/disc/{igreja_id}/{mid}.ext e retorna foto_url."""
    ext = "png" if "png" in mime else ("webp" if "webp" in mime else "jpg")
    folder = FOTOS_DISC_DIR / str(igreja_id)
    folder.mkdir(parents=True, exist_ok=True)
    for old_ext in ("jpg", "png", "webp"):
        old = folder / f"{mid}.{old_ext}"
        if old.exists():
            old.unlink()
    (folder / f"{mid}.{ext}").write_bytes(file_bytes)
    foto_url = f"/assets/fotos/disc/{igreja_id}/{mid}.{ext}"
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE membros SET foto_url=%s WHERE id=%s AND igreja_id=%s", (foto_url, mid, igreja_id))
        conn.commit()
    return foto_url


def get_membro_foto_path(mid: int, igreja_id: int) -> Path | None:
    """Retorna o Path do arquivo de foto, garantindo isolamento por igreja."""
    folder = FOTOS_DISC_DIR / str(igreja_id)
    for ext in ("jpg", "png", "webp"):
        p = folder / f"{mid}.{ext}"
        if p.exists():
            return p
    return None


def _exec(sql, params=()):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            affected = cur.rowcount
        conn.commit()
    return (dict(row) if row else None, affected)


def _check_nome_unique(table: str, nome: str, igreja_id: int, exclude_id: int | None = None) -> None:
    """Garante que não existe outro registro com o mesmo nome na mesma igreja."""
    sql = f"SELECT 1 FROM {table} WHERE LOWER(nome)=LOWER(%s) AND igreja_id=%s"
    params: list = [nome, igreja_id]
    if exclude_id:
        sql += " AND id != %s"
        params.append(exclude_id)
    rows = _run(sql, tuple(params))
    if rows:
        raise ValueError(f"Já existe um registro com o nome '{nome}'.")


def _check_cpf_unique(table: str, cpf: str, igreja_id: int, exclude_id: int | None = None) -> None:
    """Garante que CPF não está duplicado na mesma igreja."""
    cpf_clean = (cpf or "").strip()
    if not cpf_clean:
        raise ValueError("CPF obrigatório.")
    sql = f"SELECT 1 FROM {table} WHERE cpf=%s AND igreja_id=%s"
    params: list = [cpf_clean, igreja_id]
    if exclude_id:
        sql += " AND id != %s"
        params.append(exclude_id)
    rows = _run(sql, tuple(params))
    if rows:
        raise ValueError(f"CPF {cpf_clean} já cadastrado nesta igreja.")


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

def get_dashboard_stats(igreja_id: int) -> dict:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS n FROM celulas WHERE igreja_id=%s AND ativo=TRUE", (igreja_id,))
            celulas = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) AS n FROM membros WHERE igreja_id=%s AND ativo=TRUE", (igreja_id,))
            discipulos = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) AS n FROM pastores WHERE igreja_id=%s AND ativo=TRUE", (igreja_id,))
            pastores = cur.fetchone()["n"]
            cur.execute(
                """
                SELECT COALESCE(SUM(num_visitantes),0) AS v
                FROM lancamentos_celula
                WHERE igreja_id=%s
                  AND EXTRACT(MONTH FROM data_lancamento)=EXTRACT(MONTH FROM NOW())
                  AND EXTRACT(YEAR  FROM data_lancamento)=EXTRACT(YEAR  FROM NOW())
                """,
                (igreja_id,),
            )
            visitantes_mes = cur.fetchone()["v"]
    return {
        "celulas":      int(celulas),
        "discipulos":   int(discipulos),
        "pastores":     int(pastores),
        "visitantes_mes": int(visitantes_mes),
    }


# ---------------------------------------------------------------------------
# Grupos de pastor
# ---------------------------------------------------------------------------

def list_grupos_pastor(igreja_id: int) -> list[dict]:
    return _run(
        "SELECT id, nome, ativo FROM grupos_pastor WHERE igreja_id=%s ORDER BY nome",
        (igreja_id,),
    )


def upsert_grupo_pastor(payload: dict, igreja_id: int) -> dict:
    gid   = payload.get("id")
    nome  = (payload.get("nome") or "").strip()[:100]
    ativo = bool(payload.get("ativo", True))

    if not nome:
        raise ValueError("Nome obrigatório.")
    _check_nome_unique("grupos_pastor", nome, igreja_id, exclude_id=int(gid) if gid else None)

    if gid:
        row, n = _exec(
            "UPDATE grupos_pastor SET nome=%s, ativo=%s WHERE id=%s AND igreja_id=%s RETURNING id",
            (nome, ativo, int(gid), igreja_id),
        )
    else:
        row, n = _exec(
            "INSERT INTO grupos_pastor (nome, ativo, igreja_id) VALUES (%s,%s,%s) RETURNING id",
            (nome, ativo, igreja_id),
        )
    if not row:
        raise ValueError("Grupo de pastor não encontrado.")
    return {"id": row["id"]}


def excluir_grupo_pastor(gid: int, igreja_id: int) -> None:
    try:
        _, n = _exec(
            "DELETE FROM grupos_pastor WHERE id=%s AND igreja_id=%s RETURNING id",
            (gid, igreja_id),
        )
    except Exception:
        _, n = _exec(
            "UPDATE grupos_pastor SET ativo=FALSE WHERE id=%s AND igreja_id=%s RETURNING id",
            (gid, igreja_id),
        )
    if n == 0:
        raise ValueError("Grupo de pastor não encontrado.")


# ---------------------------------------------------------------------------
# Ministérios
# ---------------------------------------------------------------------------

def list_ministerios(igreja_id: int) -> list[dict]:
    return _run(
        "SELECT id, nome, ativo FROM ministerios WHERE igreja_id=%s ORDER BY nome",
        (igreja_id,),
    )


def upsert_ministerio(payload: dict, igreja_id: int) -> dict:
    mid   = payload.get("id")
    nome  = (payload.get("nome") or "").strip()[:100]
    ativo = bool(payload.get("ativo", True))

    if not nome:
        raise ValueError("Nome obrigatório.")
    _check_nome_unique("ministerios", nome, igreja_id, exclude_id=int(mid) if mid else None)

    if mid:
        row, n = _exec(
            "UPDATE ministerios SET nome=%s, ativo=%s WHERE id=%s AND igreja_id=%s RETURNING id",
            (nome, ativo, int(mid), igreja_id),
        )
    else:
        row, n = _exec(
            "INSERT INTO ministerios (nome, ativo, igreja_id) VALUES (%s,%s,%s) RETURNING id",
            (nome, ativo, igreja_id),
        )
    if not row:
        raise ValueError("Ministério não encontrado.")
    return {"id": row["id"]}


def excluir_ministerio(mid: int, igreja_id: int) -> None:
    try:
        _, n = _exec(
            "DELETE FROM ministerios WHERE id=%s AND igreja_id=%s RETURNING id",
            (mid, igreja_id),
        )
    except Exception:
        _, n = _exec(
            "UPDATE ministerios SET ativo=FALSE WHERE id=%s AND igreja_id=%s RETURNING id",
            (mid, igreja_id),
        )
    if n == 0:
        raise ValueError("Ministério não encontrado.")


# ---------------------------------------------------------------------------
# Pastores
# ---------------------------------------------------------------------------

def list_pastores(igreja_id: int) -> list[dict]:
    return _run(
        """
        SELECT p.id, p.nome, p.celular, p.email, p.titular, p.ativo,
               p.foto_url,
               g.nome AS grupo_pastor_nome
        FROM   pastores p
        LEFT   JOIN grupos_pastor g ON g.id = p.grupo_pastor_id
        WHERE  p.igreja_id = %s
        ORDER  BY p.nome
        """,
        (igreja_id,),
    )


def get_pastor(pid: int, igreja_id: int) -> dict | None:
    return _one(
        "SELECT * FROM pastores WHERE id=%s AND igreja_id=%s",
        (pid, igreja_id),
    )


def upsert_pastor(payload: dict, igreja_id: int) -> dict:
    pid     = payload.get("id")
    nome    = (payload.get("nome") or "").strip()[:100]
    email   = (payload.get("email") or "").strip()[:60]
    tel     = (payload.get("telefone") or "").strip()[:20]
    cel     = (payload.get("celular") or "").strip()[:20]
    cpf     = (payload.get("cpf") or "").strip()[:14]
    nasc    = payload.get("data_nascimento") or None
    sexo    = (payload.get("sexo") or "").strip()[:10]
    ecivil  = (payload.get("estado_civil") or "").strip()[:20]
    end     = (payload.get("endereco") or "").strip()[:100]
    num     = (payload.get("numero") or "").strip()[:10]
    bairro  = (payload.get("bairro") or "").strip()[:50]
    cidade  = (payload.get("cidade") or "").strip()[:60]
    uf      = (payload.get("uf") or "").strip()[:2].upper()
    cep     = (payload.get("cep") or "").strip()[:10]
    titular = bool(payload.get("titular", False))
    ativo   = bool(payload.get("ativo", True))
    grupo_id = payload.get("grupo_pastor_id") or None
    if grupo_id:
        grupo_id = int(grupo_id)

    if not nome:
        raise ValueError("Nome obrigatório.")
    _check_cpf_unique("pastores", cpf, igreja_id, exclude_id=int(pid) if pid else None)

    cols = "(nome,email,telefone,celular,cpf,data_nascimento,sexo,estado_civil,endereco,numero,bairro,cidade,uf,cep,titular,ativo,grupo_pastor_id,igreja_id)"
    vals = (nome, email, tel, cel, cpf, nasc, sexo, ecivil, end, num, bairro, cidade, uf, cep, titular, ativo, grupo_id, igreja_id)

    if pid:
        row, n = _exec(
            """
            UPDATE pastores SET nome=%s,email=%s,telefone=%s,celular=%s,cpf=%s,
              data_nascimento=%s,sexo=%s,estado_civil=%s,endereco=%s,numero=%s,
              bairro=%s,cidade=%s,uf=%s,cep=%s,titular=%s,ativo=%s,grupo_pastor_id=%s
            WHERE id=%s AND igreja_id=%s RETURNING id
            """,
            (*vals[:-1], int(pid), igreja_id),
        )
    else:
        row, n = _exec(
            f"INSERT INTO pastores {cols} VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            vals,
        )
    if not row:
        raise ValueError("Pastor não encontrado.")
    return {"id": row["id"]}


def save_pastor_foto(pid: int, igreja_id: int, file_bytes: bytes, mime: str) -> str:
    ext = "png" if "png" in mime else ("webp" if "webp" in mime else "jpg")
    folder = FOTOS_PASTOR_DIR / str(igreja_id)
    folder.mkdir(parents=True, exist_ok=True)
    for old_ext in ("jpg", "png", "webp"):
        old = folder / f"{pid}.{old_ext}"
        if old.exists():
            old.unlink()
    (folder / f"{pid}.{ext}").write_bytes(file_bytes)
    foto_url = f"/assets/fotos/pastor/{igreja_id}/{pid}.{ext}"
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE pastores SET foto_url=%s WHERE id=%s AND igreja_id=%s", (foto_url, pid, igreja_id))
        conn.commit()
    return foto_url


def get_pastor_foto_path(pid: int, igreja_id: int) -> Path | None:
    folder = FOTOS_PASTOR_DIR / str(igreja_id)
    for ext in ("jpg", "png", "webp"):
        p = folder / f"{pid}.{ext}"
        if p.exists():
            return p
    return None


def desativar_pastor(pid: int, igreja_id: int) -> None:
    _, n = _exec(
        "UPDATE pastores SET ativo=FALSE WHERE id=%s AND igreja_id=%s RETURNING id",
        (pid, igreja_id),
    )
    if n == 0:
        raise ValueError("Pastor não encontrado.")


# ---------------------------------------------------------------------------
# Discípulos (membros)
# ---------------------------------------------------------------------------

SITUACOES_CELULAR = ("Ativo", "Inativo", "Visitante", "Afastado", "Transferido")


def list_membros(igreja_id: int) -> list[dict]:
    return _run(
        """
        SELECT m.id, m.nome, m.celular, m.email, m.situacao_celular,
               m.ativo, m.criado_em,
               mn.nome AS ministerio_nome,
               c.nome  AS celula_nome
        FROM   membros m
        LEFT   JOIN ministerios mn ON mn.id = m.ministerio_id
        LEFT   JOIN celulas c      ON c.id  = m.celula_id
        WHERE  m.igreja_id = %s
        ORDER  BY m.nome
        """,
        (igreja_id,),
    )


def get_membro(mid: int, igreja_id: int) -> dict | None:
    return _one(
        "SELECT * FROM membros WHERE id=%s AND igreja_id=%s",
        (mid, igreja_id),
    )


def upsert_membro(payload: dict, igreja_id: int) -> dict:
    mid       = payload.get("id")
    nome      = (payload.get("nome") or "").strip()[:100]
    email     = (payload.get("email") or "").strip()[:60]
    tel       = (payload.get("telefone") or "").strip()[:20]
    cel       = (payload.get("celular") or "").strip()[:20]
    cpf       = (payload.get("cpf") or "").strip()[:14]
    ident     = (payload.get("identidade") or "").strip()[:25]
    nasc      = payload.get("data_nascimento") or None
    sexo      = (payload.get("sexo") or "").strip()[:10]
    ecivil    = (payload.get("estado_civil") or "").strip()[:20]
    instrucao = (payload.get("instrucao") or "").strip()[:30]
    end       = (payload.get("endereco") or "").strip()[:100]
    num       = (payload.get("numero") or "").strip()[:10]
    bairro    = (payload.get("bairro") or "").strip()[:50]
    cidade    = (payload.get("cidade") or "").strip()[:60]
    uf        = (payload.get("uf") or "").strip()[:2].upper()
    cep       = (payload.get("cep") or "").strip()[:10]
    sit_cel   = (payload.get("situacao_celular") or "Ativo").strip()[:15]
    obs       = (payload.get("obs") or "").strip()
    ativo     = bool(payload.get("ativo", True))
    dizimista = bool(payload.get("dizimista", False))
    carteira  = bool(payload.get("carteira_emitida", False))
    batizado  = bool(payload.get("batizado", False))
    libertacao = bool(payload.get("libertacao", False))
    encontro  = bool(payload.get("encontro", False))
    min_id    = payload.get("ministerio_id") or None
    cel_id    = payload.get("celula_id") or None
    if min_id:
        min_id = int(min_id)
    if cel_id:
        cel_id = int(cel_id)

    if not nome:
        raise ValueError("Nome obrigatório.")
    _check_cpf_unique("membros", cpf, igreja_id, exclude_id=int(mid) if mid else None)
    if sit_cel not in SITUACOES_CELULAR:
        sit_cel = "Ativo"

    if mid:
        row, n = _exec(
            """
            UPDATE membros SET nome=%s,email=%s,telefone=%s,celular=%s,cpf=%s,identidade=%s,
              data_nascimento=%s,sexo=%s,estado_civil=%s,instrucao=%s,
              endereco=%s,numero=%s,bairro=%s,cidade=%s,uf=%s,cep=%s,
              situacao_celular=%s,obs=%s,ativo=%s,dizimista=%s,carteira_emitida=%s,
              batizado=%s,libertacao=%s,encontro=%s,ministerio_id=%s,celula_id=%s
            WHERE id=%s AND igreja_id=%s RETURNING id
            """,
            (nome, email, tel, cel, cpf, ident, nasc, sexo, ecivil, instrucao,
             end, num, bairro, cidade, uf, cep, sit_cel, obs, ativo,
             dizimista, carteira, batizado, libertacao, encontro, min_id, cel_id,
             int(mid), igreja_id),
        )
    else:
        row, n = _exec(
            """
            INSERT INTO membros
              (nome,email,telefone,celular,cpf,identidade,data_nascimento,sexo,estado_civil,
               instrucao,endereco,numero,bairro,cidade,uf,cep,situacao_celular,obs,ativo,
               dizimista,carteira_emitida,batizado,libertacao,encontro,ministerio_id,celula_id,igreja_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            """,
            (nome, email, tel, cel, cpf, ident, nasc, sexo, ecivil, instrucao,
             end, num, bairro, cidade, uf, cep, sit_cel, obs, ativo,
             dizimista, carteira, batizado, libertacao, encontro, min_id, cel_id, igreja_id),
        )
    if not row:
        raise ValueError("Discípulo não encontrado.")
    return {"id": row["id"]}


def desativar_membro(mid: int, igreja_id: int) -> None:
    _, n = _exec(
        "UPDATE membros SET ativo=FALSE WHERE id=%s AND igreja_id=%s RETURNING id",
        (mid, igreja_id),
    )
    if n == 0:
        raise ValueError("Discípulo não encontrado.")


# ---------------------------------------------------------------------------
# Macrocélulas
# ---------------------------------------------------------------------------

def list_macrocelulas(igreja_id: int) -> list[dict]:
    return _run(
        """
        SELECT mc.id, mc.nome, mc.codigo, mc.descricao, mc.tipo, mc.ativo,
               mc.lider_membro_id,
               COALESCE(m.nome, '') AS lider_nome
        FROM   macrocelulas mc
        LEFT   JOIN membros m ON m.id = mc.lider_membro_id
        WHERE  mc.igreja_id = %s
        ORDER  BY mc.nome
        """,
        (igreja_id,),
    )


def get_macrocelula(mid: int, igreja_id: int) -> dict | None:
    return _one(
        """
        SELECT mc.*, COALESCE(m.nome, '') AS lider_nome
        FROM   macrocelulas mc
        LEFT   JOIN membros m ON m.id = mc.lider_membro_id
        WHERE  mc.id=%s AND mc.igreja_id=%s
        """,
        (mid, igreja_id),
    )


def upsert_macrocelula(payload: dict, igreja_id: int) -> dict:
    mid        = payload.get("id")
    nome       = (payload.get("nome") or "").strip()[:100]
    codigo     = (payload.get("codigo") or "").strip()[:20] or None
    descricao  = (payload.get("descricao") or "").strip() or None
    tipo       = (payload.get("tipo") or "").strip()[:30]
    ativo      = bool(payload.get("ativo", True))
    lider_id   = payload.get("lider_membro_id") or None
    if lider_id:
        lider_id = int(lider_id)
    if not nome:
        raise ValueError("Nome obrigatório.")
    _check_nome_unique("macrocelulas", nome, igreja_id, exclude_id=int(mid) if mid else None)
    if mid:
        row, n = _exec(
            """UPDATE macrocelulas SET nome=%s, codigo=%s, descricao=%s, tipo=%s,
               lider_membro_id=%s, ativo=%s
               WHERE id=%s AND igreja_id=%s RETURNING id""",
            (nome, codigo, descricao, tipo, lider_id, ativo, int(mid), igreja_id),
        )
    else:
        row, n = _exec(
            """INSERT INTO macrocelulas (nome, codigo, descricao, tipo, lider_membro_id, ativo, igreja_id)
               VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (nome, codigo, descricao, tipo, lider_id, ativo, igreja_id),
        )
    if not row:
        raise ValueError("Macrocélula não encontrada.")
    return {"id": row["id"]}

def excluir_macrocelula(mid: int, igreja_id: int) -> None:
    try:
        _, n = _exec("DELETE FROM macrocelulas WHERE id=%s AND igreja_id=%s RETURNING id", (mid, igreja_id))
    except Exception:
        _, n = _exec("UPDATE macrocelulas SET ativo=FALSE WHERE id=%s AND igreja_id=%s RETURNING id", (mid, igreja_id))
    if n == 0:
        raise ValueError("Macrocélula não encontrada.")

# ---------------------------------------------------------------------------
# Tipos de célula
# ---------------------------------------------------------------------------

def list_tipos_celula(igreja_id: int) -> list[dict]:
    return _run(
        "SELECT id, nome FROM tipos_celula WHERE igreja_id=%s ORDER BY nome",
        (igreja_id,),
    )

def upsert_tipo_celula(payload: dict, igreja_id: int) -> dict:
    tid  = payload.get("id")
    nome = (payload.get("nome") or "").strip()[:80]
    if not nome:
        raise ValueError("Nome obrigatório.")
    _check_nome_unique("tipos_celula", nome, igreja_id, exclude_id=int(tid) if tid else None)
    if tid:
        row, n = _exec(
            "UPDATE tipos_celula SET nome=%s WHERE id=%s AND igreja_id=%s RETURNING id",
            (nome, int(tid), igreja_id),
        )
    else:
        row, n = _exec(
            "INSERT INTO tipos_celula (nome, igreja_id) VALUES (%s,%s) RETURNING id",
            (nome, igreja_id),
        )
    if not row:
        raise ValueError("Tipo de célula não encontrado.")
    return {"id": row["id"]}

def excluir_tipo_celula(tid: int, igreja_id: int) -> None:
    try:
        _, n = _exec("DELETE FROM tipos_celula WHERE id=%s AND igreja_id=%s RETURNING id", (tid, igreja_id))
    except Exception:
        pass
    if n == 0:
        raise ValueError("Tipo de célula não encontrado.")

# ---------------------------------------------------------------------------
# Células
# ---------------------------------------------------------------------------

DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

def list_celulas(igreja_id: int) -> list[dict]:
    return _run(
        """
        SELECT c.id, c.nome, c.dia_semana, c.hora, c.status, c.ativo,
               mc.nome AS macrocelula_nome,
               tc.nome AS tipo_celula_nome,
               u.nome  AS lider_nome
        FROM   celulas c
        LEFT   JOIN macrocelulas mc ON mc.id = c.macrocelula_id
        LEFT   JOIN tipos_celula tc ON tc.id = c.tipo_celula_id
        LEFT   JOIN usuarios     u  ON u.id  = c.lider_id
        WHERE  c.igreja_id=%s AND c.ativo=TRUE
        ORDER  BY c.nome
        """,
        (igreja_id,),
    )

def get_celula(cid: int, igreja_id: int) -> dict | None:
    return _one(
        """
        SELECT c.*, mc.nome AS macrocelula_nome, tc.nome AS tipo_celula_nome, u.nome AS lider_nome
        FROM   celulas c
        LEFT   JOIN macrocelulas mc ON mc.id = c.macrocelula_id
        LEFT   JOIN tipos_celula tc ON tc.id = c.tipo_celula_id
        LEFT   JOIN usuarios     u  ON u.id  = c.lider_id
        WHERE  c.id=%s AND c.igreja_id=%s
        """,
        (cid, igreja_id),
    )

def upsert_celula(payload: dict, igreja_id: int) -> dict:
    cid              = payload.get("id")
    nome             = (payload.get("nome") or "").strip()[:100]
    macrocelula_id   = payload.get("macrocelula_id") or None
    tipo_celula_id   = payload.get("tipo_celula_id") or None
    dia_semana       = (payload.get("dia_semana") or "").strip()[:15]
    hora             = (payload.get("hora") or "").strip()[:5]
    status           = (payload.get("status") or "Ativa").strip()[:25]
    cep              = (payload.get("cep") or "").strip()[:10]
    endereco         = (payload.get("endereco") or "").strip()[:100]
    numero           = (payload.get("numero") or "").strip()[:10]
    bairro           = (payload.get("bairro") or "").strip()[:50]
    cidade           = (payload.get("cidade") or "").strip()[:60]
    uf               = (payload.get("uf") or "").strip()[:2].upper()
    telefone         = (payload.get("telefone") or "").strip()[:20]
    obs              = (payload.get("obs") or "").strip()
    ativo            = bool(payload.get("ativo", True))
    if not nome:
        raise ValueError("Nome obrigatório.")
    _check_nome_unique("celulas", nome, igreja_id, exclude_id=int(cid) if cid else None)
    if cid:
        row, n = _exec(
            """UPDATE celulas SET nome=%s, macrocelula_id=%s, tipo_celula_id=%s,
               dia_semana=%s, hora=%s, status=%s,
               cep=%s, endereco=%s, numero=%s, bairro=%s, cidade=%s, uf=%s,
               telefone=%s, obs=%s, ativo=%s
               WHERE id=%s AND igreja_id=%s RETURNING id""",
            (nome, macrocelula_id, tipo_celula_id, dia_semana, hora, status,
             cep, endereco, numero, bairro, cidade, uf, telefone, obs, ativo,
             int(cid), igreja_id),
        )
    else:
        row, n = _exec(
            """INSERT INTO celulas (nome, macrocelula_id, tipo_celula_id,
               dia_semana, hora, status, cep, endereco, numero, bairro, cidade, uf,
               telefone, obs, ativo, igreja_id)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (nome, macrocelula_id, tipo_celula_id, dia_semana, hora, status,
             cep, endereco, numero, bairro, cidade, uf, telefone, obs, ativo, igreja_id),
        )
    if not row:
        raise ValueError("Célula não encontrada.")
    return {"id": row["id"]}

def desativar_celula(cid: int, igreja_id: int) -> None:
    _, n = _exec(
        "UPDATE celulas SET ativo=FALSE WHERE id=%s AND igreja_id=%s RETURNING id",
        (cid, igreja_id),
    )
    if n == 0:
        raise ValueError("Célula não encontrada.")
