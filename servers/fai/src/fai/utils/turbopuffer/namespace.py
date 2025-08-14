from src.fai.enums.embedding_models import EmbeddingModels


def get_docs_index_name(domain: str) -> str:
    return f"{domain}_{EmbeddingModels.TEXT_EMBEDDING_3_LARGE.value.model_name}_v3"


def get_tpuf_namespace(domain: str, index_name: str) -> str:
    return f"{domain}_{index_name}"


def get_query_index_name() -> str:
    return "query"
