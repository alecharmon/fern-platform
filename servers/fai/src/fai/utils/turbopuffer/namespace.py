from src.fai.models.enums.index_names import (
    QUERY_INDEX_NAME,
    DataIndexNames,
)


def get_tpuf_namespace(domain: str, index_name: str) -> str:
    return f"{domain}_{index_name}"


def get_fern_docs_index_name() -> str:
    return DataIndexNames.FERN_DOCS.value


def get_document_index_name() -> str:
    return DataIndexNames.DOCUMENT.value


def get_guidance_index_name() -> str:
    return DataIndexNames.GUIDANCE.value


def get_query_index_name() -> str:
    return QUERY_INDEX_NAME
