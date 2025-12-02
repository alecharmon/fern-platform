"""Discord bot settings - independent configuration for Discord bot only."""

import logging
import logging.config
import os
from pathlib import Path

from dotenv import load_dotenv

_fai_root = Path(__file__).parent.parent.parent
_env_path = _fai_root / ".env.discord"
load_dotenv(_env_path)
logging.config.fileConfig("logging.conf")
LOGGER = logging.getLogger()


class DiscordVariables:
    """Environment variables required for Discord bot operation."""

    ANTHROPIC_API_KEY: str | None = os.environ.get("ANTHROPIC_API_KEY")
    OPENAI_API_KEY: str | None = os.environ.get("OPENAI_API_KEY")
    TURBOPUFFER_API_KEY: str | None = os.environ.get("TURBOPUFFER_API_KEY")

    POSTGRES_DATABASE_URL: str | None = os.environ.get("POSTGRES_DATABASE_URL")

    DISCORD_BOT_TOKEN: str | None = os.environ.get("DISCORD_BOT_TOKEN")
    DISCORD_OAUTH_URL: str | None = os.environ.get("DISCORD_OAUTH_URL")

    @classmethod
    def validate_env_variables(cls) -> None:
        """Validate that all required environment variables are set."""
        for attr_name, attr_value in vars(cls).items():
            if not attr_name.startswith("_") and isinstance(attr_value, str | type(None)):
                if attr_value is None:
                    raise ValueError(f"Discord Bot Setup: Environment variable {attr_name} is not set.")


class DiscordConfig:
    """Configuration constants for Discord bot."""

    FAI_SERVER_URL: str = os.environ.get("FAI_SERVER_URL") or "https://fai.buildwithfern.com"


VARIABLES = DiscordVariables()
CONFIG = DiscordConfig()
