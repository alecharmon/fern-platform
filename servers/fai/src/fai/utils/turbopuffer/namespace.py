from src.fai.enums.index_names import QUERY_INDEX_NAME
from src.fai.enums.index_names import DataIndexNames


def get_tpuf_namespace(domain: str, index_name: str) -> str:
    return f"{domain}_{index_name}"


def get_docs_index_name() -> str:
    return DataIndexNames.DOCS.value


def get_guidance_index_name() -> str:
    return DataIndexNames.GUIDANCE.value


def get_query_index_name() -> str:
    return QUERY_INDEX_NAME
