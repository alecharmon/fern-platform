import logging
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


class Settings:
    FAI_API_URL: str = os.environ.get("FAI_API_URL") or "https://fai.buildwithfern.com"


class SingletonFactory:
    _instances: dict[Any, Any] = {}

    @classmethod
    def get_instance(cls, target_class: Any, *args: Any, **kwargs: Any) -> Any:
        if target_class not in cls._instances:
            cls._instances[target_class] = target_class(*args, **kwargs)
        return cls._instances[target_class]


SETTINGS = SingletonFactory.get_instance(Settings)
