from typing import Any
from typing import Dict


def as_dict(obj: Any) -> Dict[str, Any]:
    """
    Best-effort to turn SDK/Pydantic rows into dicts without assuming .get exists.
    """
    if hasattr(obj, "model_dump") and callable(getattr(obj, "model_dump")):
        try:
            return obj.model_dump()
        except Exception:
            pass
    if hasattr(obj, "dict") and callable(getattr(obj, "dict")):
        try:
            return obj.dict()
        except Exception:
            pass
    return {}
