from typing import Any
from typing import Dict


def get_data_index_tpuf_schema() -> Dict[str, Any]:
    return {
        "id": "string",
        "vector": {"type": "[3072]f32", "ann": True, "bm25": False},
        "chunk": {"type": "string", "filterable": False, "bm25": False},
        "document": {"type": "string", "filterable": False, "bm25": False},
        "title": {"type": "string", "filterable": True, "bm25": True},
        "url": {"type": "string", "filterable": True, "bm25": False},
        "version": {"type": "string", "filterable": True, "bm25": False},
        "keywords": {"type": "[]string", "filterable": False, "bm25": True},
        "authed": {"type": "bool", "filterable": True, "bm25": False},
    }


def get_query_index_tpuf_schema() -> Dict[str, Any]:
    return {
        "id": "string",
        "vector": {"type": "[3072]f32", "ann": True, "bm25": False},
        "chunk": {"type": "string", "filterable": False, "bm25": False},
        "document": {"type": "string", "filterable": False, "bm25": False},
        "title": {"type": "string", "filterable": True, "bm25": True},
        "url": {"type": "string", "filterable": True, "bm25": False},
        "version": {"type": "string", "filterable": True, "bm25": False},
        "keywords": {"type": "[]string", "filterable": False, "bm25": True},
        "authed": {"type": "bool", "filterable": True, "bm25": False},
        "source": "string",
    }
