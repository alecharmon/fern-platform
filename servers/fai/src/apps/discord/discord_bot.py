import discord
from discord.ext import tasks
from dotenv import load_dotenv
from sqlalchemy import delete

from src.apps.discord.commands.configure import ConfigureView
from src.apps.discord.message.message_handler import handle_discord_message
from src.apps.discord.shard_manager import ShardManager
from src.fai.db import async_session_maker
from src.fai.models.db.discord_integration_db import DiscordIntegrationDb
from src.settings import (
    LOGGER,
    VARIABLES,
)

load_dotenv()
bot_token = VARIABLES.DISCORD_BOT_TOKEN


class AskFernDiscordClient(discord.AutoShardedClient):
    def __init__(self, shard_id: int) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.messages = True
        intents.guilds = True
        super().__init__(intents=intents, shard_count=2, shard_ids=[shard_id])
        self.tree = discord.app_commands.CommandTree(self)
        self.shard_manager: ShardManager | None = None

    async def setup_hook(self) -> None:
        await self.tree.sync()
        LOGGER.info("Slash commands synced")
        self.refresh_claim_loop.start()

    async def on_ready(self) -> None:
        LOGGER.info(f"Connected to {len(self.guilds)} guilds on this shard:")
        for guild in self.guilds:
            shard_id = (guild.id >> 22) % 2
            LOGGER.info(f"  - {guild.name} (ID: {guild.id}) -> shard {shard_id}")

    @tasks.loop(minutes=2)
    async def refresh_claim_loop(self) -> None:
        """Refresh shard claim every 2 minutes."""
        if self.shard_manager:
            self.shard_manager.refresh_claim()

    async def on_guild_join(self, guild: discord.Guild) -> None:
        shard_id = (guild.id >> 22) % 2
        LOGGER.info(f"Bot added to: {guild.name} (ID: {guild.id}) -> shard {shard_id}")

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


client: AskFernDiscordClient | None = None


def setup_client(shard_id: int) -> AskFernDiscordClient:
    """Initialize the Discord client with the given shard ID."""
    global client
    client = AskFernDiscordClient(shard_id)

    @discord.app_commands.default_permissions(administrator=True)
    @client.tree.command(name="configure", description="Configure bot settings")
    async def configure(interaction: discord.Interaction) -> None:
        view = ConfigureView(channel_id=str(interaction.channel.id))
        await interaction.response.send_message(
            "**Configure Ask Fern:**\n\n"
            "**Respond to:**\n"
            "• **Channels:** Select how the bot responds in channels\n"
            "• **Threads:** Select how the bot responds in threads",
            view=view,
            ephemeral=True,
        )

    return client


async def start_discord_bot() -> None:
    """Start the Discord bot with shard claiming."""
    global client

    # Claim a shard
    shard_manager = ShardManager()
    shard_id = shard_manager.claim_shard()

    # Initialize client with claimed shard
    client = setup_client(shard_id)
    client.shard_manager = shard_manager

    # Start the bot (refresh loop starts automatically in setup_hook)
    await client.start(bot_token)


async def safe_run_discord() -> None:
    """Run Discord bot with error handling to prevent crashes from affecting FastAPI"""
    try:
        await start_discord_bot()
    except KeyboardInterrupt:
        LOGGER.info("Discord bot shutting down...")
    except Exception as e:
        LOGGER.error(f"Discord bot failed but FastAPI will continue running: {e}")
    finally:
        # Close the client and release shard on shutdown
        if client:
            await client.close()
            if client.shard_manager:
                client.shard_manager.release_shard()
