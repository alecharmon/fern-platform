import logging

from discord_bot.bot import start_discord_bot
from discord_bot.settings import (
    LOGGER,
    VARIABLES,
)


def start() -> None:
    """Launched with `poetry run discord` at root level"""

    LOGGER.info("Discord Bot Setup: Starting environment variable validation...")
    VARIABLES.validate_env_variables()
    LOGGER.info("Discord Bot Setup: Environment variables validated.")

    LOGGER.info("Starting Discord bot...")

    logging.getLogger("discord").setLevel(logging.WARNING)
    logging.getLogger("discord.http").setLevel(logging.WARNING)
    logging.getLogger("discord.gateway").setLevel(logging.WARNING)
    logging.getLogger("discord.client").setLevel(logging.WARNING)

    start_discord_bot()


if __name__ == "__main__":
    start()
