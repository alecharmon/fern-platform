import discord
from dotenv import load_dotenv
from sqlalchemy import delete

from discord_bot.commands.configure import ConfigureView
from discord_bot.db import async_session_maker
from discord_bot.message.message_handler import handle_discord_message
from discord_bot.settings import (
    LOGGER,
    VARIABLES,
)
from fai.models.db.discord_integration_db import DiscordIntegrationDb

load_dotenv()
bot_token = VARIABLES.DISCORD_BOT_TOKEN


class AskFernDiscordClient(discord.Client):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.messages = True
        intents.guilds = True
        intents.members = True
        super().__init__(intents=intents)
        self.tree = discord.app_commands.CommandTree(self)

    async def setup_hook(self) -> None:
        await self.tree.sync()
        LOGGER.info("Slash commands synced")

    async def on_ready(self) -> None:
        LOGGER.info(f"Logged on as {self.user}")

    async def on_guild_join(self, guild: discord.Guild) -> None:
        LOGGER.info(f"Bot added to: {guild.name} (ID: {guild.id})")

    async def on_guild_remove(self, guild: discord.Guild) -> None:
        LOGGER.info(f"Bot removed from: {guild.name} (ID: {guild.id})")
        await self.handle_remove_discord_integration(str(guild.id))

    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot:
            return
        await handle_discord_message(message)

    @staticmethod
    async def handle_remove_discord_integration(guild_id: str) -> None:
        async with async_session_maker() as session:
            await session.execute(delete(DiscordIntegrationDb).where(DiscordIntegrationDb.discord_guild_id == guild_id))
            await session.commit()


client = AskFernDiscordClient()


@discord.app_commands.default_permissions(administrator=True)
@client.tree.command(name="configure", description="Configure bot settings")
async def configure(interaction: discord.Interaction) -> None:
    view = ConfigureView(channel_id=str(interaction.channel.id))
    await interaction.response.send_message(
        "**Configure Ask Fern:**",
        view=view,
        ephemeral=True,
    )


def start_discord_bot() -> None:
    client.run(bot_token)
