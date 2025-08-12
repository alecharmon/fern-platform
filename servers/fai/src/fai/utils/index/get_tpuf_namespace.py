from src.enums.embedding_models import EmbeddingModels


def get_docs_tpuf_namespace(domain: str) -> str:
    return f"{domain}_{EmbeddingModels.TEXT_EMBEDDING_3_LARGE.value.model_name}_v2"


def get_tpuf_namespace(domain: str, index_name: str) -> str:
    return f"{domain}_{index_name}"


def get_tpuf_query_namespace(domain: str) -> str:
    return f"{domain}_query"
