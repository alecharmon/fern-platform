from enum import Enum

from fai.models.utils.model import EmbeddingModel


class EmbeddingModels(Enum):
    TEXT_EMBEDDING_3_LARGE = EmbeddingModel(
        model_name="text-embedding-3-large",
        model_id="text-embedding-3-large",
        model_provider="openai",
    )
