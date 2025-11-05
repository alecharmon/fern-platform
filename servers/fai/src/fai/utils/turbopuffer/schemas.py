from typing import Any


def get_data_index_tpuf_schema() -> dict[str, Any]:
    return {
        "id": "string",
        "vector": {"type": "[3072]f32", "ann": True},
        "chunk": {
            "type": "string",
            "filterable": False,
            "full_text_search": {
                "language": "english",
                "stemming": True,
                "remove_stopwords": True,
                "case_sensitive": False,
            },
        },
        "document": {"type": "string", "filterable": False},
        "title": {"type": "string", "filterable": True, "full_text_search": True},
        "url": {"type": "string", "filterable": True},
        "version": {"type": "string", "filterable": True},
        "product": {"type": "string", "filterable": True},
        "roles": {"type": "[]string", "filterable": True},
        "keywords": {"type": "[]string", "filterable": False, "full_text_search": True},
        "authed": {"type": "bool", "filterable": True},
    }


def get_query_index_tpuf_schema() -> dict[str, Any]:
    return {
        "id": "string",
        "vector": {"type": "[3072]f32", "ann": True},
        "chunk": {
            "type": "string",
            "filterable": False,
            "full_text_search": {
                "language": "english",
                "stemming": True,
                "remove_stopwords": True,
                "case_sensitive": False,
            },
        },
        "document": {"type": "string", "filterable": False},
        "title": {"type": "string", "filterable": True, "full_text_search": True},
        "url": {"type": "string", "filterable": True},
        "version": {"type": "string", "filterable": True},
        "product": {"type": "string", "filterable": True},
        "roles": {"type": "[]string", "filterable": True},
        "keywords": {"type": "[]string", "filterable": False, "full_text_search": True},
        "authed": {"type": "bool", "filterable": True},
        "source": {"type": "string", "filterable": True},
    }
