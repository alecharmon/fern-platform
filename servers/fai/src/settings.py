import logging
import logging.config
import os
from typing import Any

from dotenv import load_dotenv

from src.fai.models.enums.embedding_models import EmbeddingModels
from src.fai.models.utils.model import EmbeddingModel

load_dotenv()
logging.config.fileConfig("logging.conf")
LOGGER = logging.getLogger()


class Variables:
    ANTHROPIC_API_KEY: str | None = os.environ.get("ANTHROPIC_API_KEY")
    COHERE_API_KEY: str | None = os.environ.get("COHERE_API_KEY")
    OPENAI_API_KEY: str | None = os.environ.get("OPENAI_API_KEY")
    POSTGRES_DATABASE_URL: str | None = os.environ.get("POSTGRES_DATABASE_URL")
    TURBOPUFFER_API_KEY: str | None = os.environ.get("TURBOPUFFER_API_KEY")
    IS_LOCAL: bool = os.environ.get("IS_LOCAL", "false").lower() == "true"

    SLACK_CLIENT_ID: str | None = os.environ.get("SLACK_CLIENT_ID")
    SLACK_CLIENT_SECRET: str | None = os.environ.get("SLACK_CLIENT_SECRET")
    SLACK_SIGNING_SECRET: str | None = os.environ.get("SLACK_SIGNING_SECRET")

    DISCORD_BOT_TOKEN: str | None = os.environ.get("DISCORD_BOT_TOKEN")
    DISCORD_OAUTH_URL: str | None = os.environ.get("DISCORD_OAUTH_URL")

    KV_REST_API_READ_ONLY_TOKEN: str | None = os.environ.get("KV_REST_API_READ_ONLY_TOKEN")
    KV_REST_API_URL: str | None = os.environ.get("KV_REST_API_URL")

    @classmethod
    def validate_env_variables(cls) -> None:
        for attr_name, attr_value in vars(cls).items():
            if not attr_name.startswith("_") and isinstance(attr_value, str | type(None)):
                if attr_value is None:
                    raise ValueError(f"Setup: Environment variable {attr_name} is not set.")


class Config:
    MIN_INSIGHTS_QUERIES: int = 100
    MAX_INSIGHTS_QUERIES: int = 1000
    MAX_INSIGHTS_EXAMPLES: int = 5
    INSIGHTS_NUM_CLUSTERS: int = 5
    EMBEDDING_BATCH_SIZE: int = 100
    INSIGHTS_MAX_EXAMPLES: int = 25
    TURBOPUFFER_DEFAULT_REGION: str = "gcp-us-east4"
    DEFAULT_EMBEDDING_MODEL: EmbeddingModel = EmbeddingModels.TEXT_EMBEDDING_3_LARGE.value


class SingletonFactory:
    _instances: dict[Any, Any] = {}

    @classmethod
    def get_instance(cls, target_class: Any, *args: Any, **kwargs: Any) -> Any:
        if target_class not in cls._instances:
            cls._instances[target_class] = target_class(*args, **kwargs)
        return cls._instances[target_class]


VARIABLES = SingletonFactory.get_instance(Variables)
CONFIG = SingletonFactory.get_instance(Config)
VARIABLES.validate_env_variables()
