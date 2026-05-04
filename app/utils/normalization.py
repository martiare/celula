def normalize_text(value, max_length: int | None = None):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if max_length is not None:
        return text[:max_length]
    return text


def parse_bool_value(value, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "t", "sim", "s", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "f", "nao", "não", "n", "no", "off"}:
        return False
    return default


def normalize_active_sql(value) -> bool:
    return parse_bool_value(value, default=True)


def parse_import_flag(value) -> str:
    if value is None:
        return "N"
    text = str(value).strip().upper()
    if text in {"1", "TRUE", "T", "SIM", "S", "Y", "YES"}:
        return "S"
    return text[:1] if text else "N"
