import psycopg2
from psycopg2.extras import RealDictCursor

from app.auth.tokens import hash_senha
from app.database.connection import get_db_connection

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

NIVEIS_VALIDOS = (
    "administrador",
    "pastor_presidente",
    "lider_macro",
    "lider_celula",
    "secretario",
    "observer",
)


# ---------------------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------------------

def authenticate_user(email: str, senha: str) -> dict | None:
    """Autentica pelo e-mail + senha (SHA-256). Retorna dict do usuário ou None."""
    senha_hash = hash_senha(senha)
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, nome, email, nivel, foto_url
                FROM usuarios
                WHERE email = %s AND senha_hash = %s AND ativo = TRUE
                """,
                (email, senha_hash),
            )
            user = cur.fetchone()
            if not user:
                return None
            cur.execute("UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = %s", (user["id"],))
            cur.execute(
                """
                SELECT v.igreja_id, i.nome AS igreja_nome,
                       COALESCE(v.nivel::text, %s) AS nivel_efetivo
                FROM vinculos_usuario_igreja v
                JOIN igrejas i ON i.id = v.igreja_id
                WHERE v.usuario_id = %s AND v.ativo = TRUE AND i.ativo = TRUE
                ORDER BY i.nome
                """,
                (user["nivel"], user["id"]),
            )
            igrejas = [
                {"id": r["igreja_id"], "nome": r["igreja_nome"], "nivel": r["nivel_efetivo"]}
                for r in cur.fetchall()
            ]
        conn.commit()
    return {
        "id":          user["id"],
        "nome":        user["nome"],
        "email":       user["email"],
        "nivel":       user["nivel"],
        "foto_url":    user["foto_url"],
        "igreja_id":   igrejas[0]["id"]   if igrejas else None,
        "igreja_nome": igrejas[0]["nome"] if igrejas else None,
        "igrejas":     igrejas,
    }


# ---------------------------------------------------------------------------
# Usuários
# ---------------------------------------------------------------------------

def list_usuarios() -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT u.id, u.nome, u.email, u.nivel, u.ativo,
                       COALESCE(
                           STRING_AGG(i.nome, ', ' ORDER BY i.nome), ''
                       ) AS igrejas
                FROM usuarios u
                LEFT JOIN vinculos_usuario_igreja v ON v.usuario_id = u.id AND v.ativo = TRUE
                LEFT JOIN igrejas i ON i.id = v.igreja_id AND i.ativo = TRUE
                GROUP BY u.id, u.nome, u.email, u.nivel, u.ativo
                ORDER BY u.nome
                """
            )
            return list(cur.fetchall())


def upsert_usuario(payload: dict) -> dict:
    uid   = payload.get("id")
    nome  = (payload.get("nome") or "").strip()[:100]
    email = (payload.get("email") or "").strip()[:100]
    nivel = (payload.get("nivel") or "observer").strip()
    senha = (payload.get("senha") or "").strip()
    ativo = bool(payload.get("ativo", True))

    if not nome:
        raise ValueError("Nome obrigatorio.")
    if not email:
        raise ValueError("E-mail obrigatorio.")
    if nivel not in NIVEIS_VALIDOS:
        raise ValueError(f"Nivel invalido. Opcoes: {', '.join(NIVEIS_VALIDOS)}")
    if not uid and not senha:
        raise ValueError("Senha obrigatoria para novo usuario.")

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if uid:
                sets = "nome=%s, email=%s, nivel=%s::nivel_acesso, ativo=%s"
                vals: list = [nome, email, nivel, ativo]
                if senha:
                    sets += ", senha_hash=%s"
                    vals.append(hash_senha(senha))
                vals.append(int(uid))
                cur.execute(f"UPDATE usuarios SET {sets} WHERE id=%s RETURNING id", vals)
            else:
                cur.execute(
                    """
                    INSERT INTO usuarios (nome, email, senha_hash, nivel, ativo)
                    VALUES (%s, %s, %s, %s::nivel_acesso, %s) RETURNING id
                    """,
                    (nome, email, hash_senha(senha), nivel, ativo),
                )
            row = cur.fetchone()
            if not row:
                raise ValueError("Usuario nao encontrado.")
        conn.commit()
    return {"id": row["id"]}


def desativar_usuario(uid: int) -> None:
    """Desativa o usuário. Não permite exclusão física."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE usuarios SET ativo = FALSE WHERE id = %s RETURNING id", (uid,)
            )
            if cur.rowcount == 0:
                raise ValueError("Usuario nao encontrado.")
        conn.commit()


# ---------------------------------------------------------------------------
# Igrejas
# ---------------------------------------------------------------------------

def list_igrejas() -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, nome, cnpj, cidade, uf, telefone, email, ativo FROM igrejas ORDER BY nome"
            )
            return list(cur.fetchall())


def upsert_igreja(payload: dict) -> dict:
    iid    = payload.get("id")
    nome   = (payload.get("nome") or "").strip()[:100]
    cnpj   = (payload.get("cnpj") or "").strip()[:18]
    cidade = (payload.get("cidade") or "").strip()[:60]
    uf     = (payload.get("uf") or "").strip()[:2].upper()
    tel    = (payload.get("telefone") or "").strip()[:20]
    email  = (payload.get("email") or "").strip()[:60]
    ativo  = bool(payload.get("ativo", True))

    if not nome:
        raise ValueError("Nome da igreja obrigatorio.")

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if iid:
                cur.execute(
                    """
                    UPDATE igrejas
                    SET nome=%s, cnpj=%s, cidade=%s, uf=%s, telefone=%s, email=%s, ativo=%s
                    WHERE id=%s RETURNING id
                    """,
                    (nome, cnpj, cidade, uf, tel, email, ativo, int(iid)),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO igrejas (nome, cnpj, cidade, uf, telefone, email, ativo)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id
                    """,
                    (nome, cnpj, cidade, uf, tel, email, ativo),
                )
            row = cur.fetchone()
            if not row:
                raise ValueError("Igreja nao encontrada.")
        conn.commit()
    return {"id": row["id"]}


def desativar_igreja(iid: int) -> None:
    """Desativa a igreja somente se não houver vínculos ativos."""
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT COUNT(*) AS total FROM vinculos_usuario_igreja WHERE igreja_id=%s AND ativo=TRUE",
                (iid,),
            )
            if cur.fetchone()["total"] > 0:
                raise ValueError(
                    "Nao e possivel desativar: ha usuarios vinculados a esta igreja. "
                    "Desative os vinculos primeiro."
                )
            cur.execute(
                "UPDATE igrejas SET ativo = FALSE WHERE id = %s RETURNING id", (iid,)
            )
            if cur.rowcount == 0:
                raise ValueError("Igreja nao encontrada.")
        conn.commit()


# ---------------------------------------------------------------------------
# Vínculos usuário ↔ Igreja
# ---------------------------------------------------------------------------

def list_vinculos() -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT v.id, v.usuario_id, u.nome AS usuario_nome, u.email AS usuario_email,
                       v.igreja_id, i.nome AS igreja_nome,
                       COALESCE(v.nivel::text, u.nivel::text) AS nivel, v.ativo
                FROM vinculos_usuario_igreja v
                JOIN usuarios u ON u.id = v.usuario_id
                JOIN igrejas  i ON i.id = v.igreja_id
                ORDER BY u.nome, i.nome
                """
            )
            return list(cur.fetchall())


def upsert_vinculo(payload: dict) -> dict:
    vid        = payload.get("id")
    usuario_id = payload.get("usuario_id")
    igreja_id  = payload.get("igreja_id")
    nivel      = (payload.get("nivel") or "").strip() or None
    ativo      = bool(payload.get("ativo", True))

    try:
        usuario_id = int(usuario_id)
        igreja_id  = int(igreja_id)
    except (TypeError, ValueError) as e:
        raise ValueError("usuario_id e igreja_id sao obrigatorios.") from e

    if nivel and nivel not in NIVEIS_VALIDOS:
        raise ValueError(f"Nivel invalido. Opcoes: {', '.join(NIVEIS_VALIDOS)}")

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if vid:
                cur.execute(
                    """
                    UPDATE vinculos_usuario_igreja
                    SET usuario_id=%s, igreja_id=%s, nivel=%s::nivel_acesso, ativo=%s
                    WHERE id=%s RETURNING id
                    """,
                    (usuario_id, igreja_id, nivel, ativo, int(vid)),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO vinculos_usuario_igreja (usuario_id, igreja_id, nivel, ativo)
                    VALUES (%s, %s, %s::nivel_acesso, %s) RETURNING id
                    """,
                    (usuario_id, igreja_id, nivel, ativo),
                )
            row = cur.fetchone()
            if not row:
                raise ValueError("Vinculo nao encontrado.")
        conn.commit()
    return {"id": row["id"]}


def desativar_vinculo(vid: int) -> None:
    """Desativa o vínculo. Nunca exclui fisicamente."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE vinculos_usuario_igreja SET ativo = FALSE WHERE id = %s RETURNING id",
                (vid,),
            )
            if cur.rowcount == 0:
                raise ValueError("Vinculo nao encontrado.")
        conn.commit()
