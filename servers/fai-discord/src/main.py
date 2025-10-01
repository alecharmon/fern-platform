import logging

from fai.settings import (
    LOGGER,
    VARIABLES,
)
from src.bot import start_discord_bot


def start() -> None:
    """Launched with `poetry run start` at root level"""

    LOGGER.info("Setup: Starting environment variable validation...")
    VARIABLES.validate_env_variables()
    LOGGER.info("Setup: Environment variables validated.")

    LOGGER.info("Starting Discord bot...")

    logging.getLogger("discord").setLevel(logging.WARNING)
    logging.getLogger("discord.http").setLevel(logging.WARNING)
    logging.getLogger("discord.gateway").setLevel(logging.WARNING)
    logging.getLogger("discord.client").setLevel(logging.WARNING)

    start_discord_bot()


if __name__ == "__main__":
    start()
