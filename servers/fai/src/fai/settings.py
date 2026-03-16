import logging
import logging.config
import os
from typing import Any

from dotenv import load_dotenv

from fai.models.enums.embedding_models import EmbeddingModels
from fai.models.utils.model import EmbeddingModel

load_dotenv()
logging.config.fileConfig("logging.conf")
LOGGER = logging.getLogger()


class Variables:
    IS_LOCAL: bool = os.environ.get("IS_LOCAL", "false").lower() == "true"
    ANTHROPIC_API_KEY: str | None = os.environ.get("ANTHROPIC_API_KEY")
    COHERE_API_KEY: str | None = os.environ.get("COHERE_API_KEY")
    OPENAI_API_KEY: str | None = os.environ.get("OPENAI_API_KEY")
    POSTGRES_DATABASE_URL: str | None = os.environ.get("POSTGRES_DATABASE_URL")
    TURBOPUFFER_API_KEY: str | None = os.environ.get("TURBOPUFFER_API_KEY")

    FERNIE_SLACK_BOT_TOKEN: str | None = os.environ.get("FERNIE_SLACK_BOT_TOKEN")
    ASK_FERN_SLACK_BOT_TOKEN: str | None = os.environ.get("ASK_FERN_SLACK_BOT_TOKEN")
    SCRIBE_SLACK_BOT_TOKEN: str | None = os.environ.get("SCRIBE_SLACK_BOT_TOKEN")

    ASK_FERN_SLACK_CLIENT_ID: str | None = os.environ.get("ASK_FERN_SLACK_CLIENT_ID")
    ASK_FERN_SLACK_CLIENT_SECRET: str | None = os.environ.get("ASK_FERN_SLACK_CLIENT_SECRET")
    ASK_FERN_SLACK_SIGNING_SECRET: str | None = os.environ.get("ASK_FERN_SLACK_SIGNING_SECRET")

    SCRIBE_SLACK_CLIENT_ID: str | None = os.environ.get("SCRIBE_SLACK_CLIENT_ID")
    SCRIBE_SLACK_CLIENT_SECRET: str | None = os.environ.get("SCRIBE_SLACK_CLIENT_SECRET")
    SCRIBE_SLACK_SIGNING_SECRET: str | None = os.environ.get("SCRIBE_SLACK_SIGNING_SECRET")
    SCRIBE_DEVIN_API_KEY: str | None = os.environ.get("SCRIBE_DEVIN_API_KEY")
    FERN_GITHUB_TOKEN: str | None = os.environ.get("FERN_GITHUB_TOKEN")
    FERN_BOT_APP_ID: str | None = os.environ.get("FERN_BOT_APP_ID")
    FERN_BOT_PRIVATE_KEY: str | None = os.environ.get("FERN_BOT_PRIVATE_KEY")

    DISCORD_BOT_TOKEN: str | None = os.environ.get("DISCORD_BOT_TOKEN")
    DISCORD_OAUTH_URL: str | None = os.environ.get("DISCORD_OAUTH_URL")

    KV_REST_API_READ_ONLY_TOKEN: str | None = os.environ.get("KV_REST_API_READ_ONLY_TOKEN")
    KV_REST_API_TOKEN: str | None = os.environ.get("KV_REST_API_TOKEN")
    KV_REST_API_URL: str | None = os.environ.get("KV_REST_API_URL")

    # Middleware KV — separate Upstash instance where basepath-routes and domain-settings live.
    # Falls back to the main KV if not set, for local dev convenience.
    # Typed as str (not str | None) with empty-string default so validate_env_variables() won't
    # crash on startup when these are unset. The `or` fallback in dependencies.py handles "".
    MWARE_KV_REST_API_URL: str = os.environ.get("MWARE_KV_REST_API_URL", "")
    MWARE_KV_REST_API_TOKEN: str = os.environ.get("MWARE_KV_REST_API_TOKEN", "")

    POSTHOG_API_KEY: str | None = os.environ.get("POSTHOG_API_KEY")

    FERN_TOKEN: str | None = os.environ.get("FERN_TOKEN")
    FDR_REGISTRY_URL: str = os.environ.get("FDR_REGISTRY_URL", "https://registry.buildwithfern.com")
    VENUS_URL: str | None = os.environ.get("VENUS_URL")
    FAI_LAMBDA_FUNCTION_NAME: str | None = os.environ.get("FAI_LAMBDA_FUNCTION_NAME")
    FAI_REINDEXING_SQS_URL: str | None = os.environ.get("FAI_REINDEXING_SQS_URL")

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
    FAI_SERVER_URL: str = os.environ.get("FAI_SERVER_URL") or "https://fai.buildwithfern.com"
    DEFAULT_EMBEDDING_MODEL: EmbeddingModel = EmbeddingModels.TEXT_EMBEDDING_3_LARGE.value
    ENABLE_LOCAL_SCHEDULED_JOBS: bool = os.environ.get("ENABLE_LOCAL_SCHEDULED_JOBS", "false").lower() == "true"
    SKIP_LOCAL_DB_INIT: bool = os.environ.get("SKIP_LOCAL_DB_INIT", "false").lower() == "true"


class SingletonFactory:
    _instances: dict[Any, Any] = {}

    @classmethod
    def get_instance(cls, target_class: Any, *args: Any, **kwargs: Any) -> Any:
        if target_class not in cls._instances:
            cls._instances[target_class] = target_class(*args, **kwargs)
        return cls._instances[target_class]


VARIABLES = SingletonFactory.get_instance(Variables)
CONFIG = SingletonFactory.get_instance(Config)
