import logging
import logging.config
import os

from typing import Any
from typing import Dict
from typing import Optional

from dotenv import load_dotenv

from src.fai.enums.embedding_models import EmbeddingModels
from src.fai.models.types.model import EmbeddingModel


load_dotenv()
logging.config.fileConfig("logging.conf")
LOGGER = logging.getLogger()


class Variables:
    ANTHROPIC_API_KEY: Optional[str] = os.environ.get("ANTHROPIC_API_KEY")
    OPENAI_API_KEY: Optional[str] = os.environ.get("OPENAI_API_KEY")
    POSTGRES_DATABASE_URL: Optional[str] = os.environ.get("POSTGRES_DATABASE_URL")
    TURBOPUFFER_API_KEY: Optional[str] = os.environ.get("TURBOPUFFER_API_KEY")
    IS_LOCAL: bool = os.environ.get("IS_LOCAL", "false").lower() == "true"

    @classmethod
    def validate_env_variables(cls) -> None:
        for attr_name, attr_value in vars(cls).items():
            if not attr_name.startswith("_") and isinstance(attr_value, (str, type(None))):
                if attr_value is None:
                    raise ValueError(f"Setup: Environment variable {attr_name} is not set.")


class Config:
    INSIGHTS_NUM_CLUSTERS: int = 8
    EMBEDDING_BATCH_SIZE: int = 100
    INSIGHTS_MAX_EXAMPLES: int = 25
    TURBOPUFFER_DEFAULT_REGION: str = "gcp-us-east4"
    DEFAULT_EMBEDDING_MODEL: EmbeddingModel = EmbeddingModels.TEXT_EMBEDDING_3_LARGE.value


class SingletonFactory:
    _instances: Dict[Any, Any] = {}

    @classmethod
    def get_instance(cls, target_class: Any, *args: Any, **kwargs: Any) -> Any:
        if target_class not in cls._instances:
            cls._instances[target_class] = target_class(*args, **kwargs)
        return cls._instances[target_class]


VARIABLES = SingletonFactory.get_instance(Variables)
CONFIG = SingletonFactory.get_instance(Config)
VARIABLES.validate_env_variables()
