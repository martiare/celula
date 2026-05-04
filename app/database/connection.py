import threading

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor

from app.config.settings import (
    get_env,
    get_db_connect_timeout,
    get_db_sslmode,
)

_db_pool: psycopg2.pool.ThreadedConnectionPool | None = None
_db_pool_lock = threading.Lock()


def _build_pool() -> psycopg2.pool.ThreadedConnectionPool:
    return psycopg2.pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=5,
        host=get_env("PGHOST"),
        database=get_env("PGDATABASE"),
        user=get_env("PGUSER"),
        password=get_env("PGPASSWORD"),
        port=get_env("PGPORT"),
        connect_timeout=get_db_connect_timeout(),
        sslmode=get_db_sslmode(),
    )


def _reset_pool() -> None:
    global _db_pool
    with _db_pool_lock:
        try:
            if _db_pool is not None:
                _db_pool.closeall()
        except Exception:
            pass
        _db_pool = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _db_pool
    if _db_pool is not None and not _db_pool.closed:
        return _db_pool
    with _db_pool_lock:
        if _db_pool is None or _db_pool.closed:
            _db_pool = _build_pool()
    return _db_pool


def _ping(conn) -> bool:
    """Retorna False se a conexão está morta."""
    if conn.closed:
        return False
    try:
        conn.cursor().execute("SELECT 1")
        return True
    except Exception:
        return False


class _PooledConn:
    """Context manager com retry automático quando a conexão está morta."""

    def __init__(self):
        self._conn = None

    def __enter__(self):
        for attempt in range(2):
            try:
                conn = _get_pool().getconn()
                if not _ping(conn):
                    try:
                        _get_pool().putconn(conn, close=True)
                    except Exception:
                        pass
                    raise psycopg2.OperationalError("dead connection")
                self._conn = conn
                return self._conn
            except (psycopg2.OperationalError, psycopg2.InterfaceError):
                if attempt == 0:
                    _reset_pool()
                else:
                    raise
        return self._conn

    def __exit__(self, exc_type, *_):
        if self._conn is None:
            return
        if exc_type:
            try:
                self._conn.rollback()
            except Exception:
                pass
        try:
            _get_pool().putconn(self._conn)
        except Exception:
            # Pool foi resetado enquanto a conexão estava em uso — descarta
            try:
                self._conn.close()
            except Exception:
                pass


def get_db_connection():
    return _PooledConn()


def fetch_rows(query: str, params: tuple) -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            return list(cur.fetchall())
