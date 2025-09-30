import discord
from sqlalchemy import update

from src.fai.db import async_session_maker
from src.fai.models.db.discord_integration_db import DiscordIntegrationDb


class ConfigureView(discord.ui.View):
    def __init__(self, channel_id: str, channel_response: str = "mentions_only", thread_response: str = "all_messages"):
        super().__init__()
        self.channel_id = channel_id
        self.channel_response = channel_response
        self.thread_response = thread_response

    @discord.ui.select(
        placeholder="Select channel setting",
        options=[
            discord.SelectOption(label="mentions_only", value="mentions_only", description="Respond only to mentions"),
            discord.SelectOption(label="all messages", value="all_messages", description="Respond to all messages"),
        ],
        row=0,  # First row
    )
    async def channel_select(self, interaction: discord.Interaction, select: discord.ui.Select) -> None:
        self.channel_response = select.values[0]
        await interaction.response.defer()

    @discord.ui.select(
        placeholder="Select thread setting",
        options=[
            discord.SelectOption(label="mentions_only", value="mentions_only", description="Respond only to mentions"),
            discord.SelectOption(label="all messages", value="all_messages", description="Respond to all messages"),
        ],
        row=1,  # Second row (must be on separate row)
    )
    async def thread_select(self, interaction: discord.Interaction, select: discord.ui.Select) -> None:
        self.thread_response = select.values[0]
        await interaction.response.defer()

    @discord.ui.button(label="Save Configuration", style=discord.ButtonStyle.primary, row=2)  # Third row
    async def save_config(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        try:
            async with async_session_maker() as session:
                await session.execute(
                    update(DiscordIntegrationDb)
                    .where(DiscordIntegrationDb.discord_guild_id == str(interaction.guild.id))
                    .values(settings=self.construct_settings())
                )
                await session.commit()
            await interaction.response.send_message(
                f"**Configuration saved!**\n\n"
                f"**Respond to:**\n"
                f"• Channels: {self.channel_response}\n"
                f"• Threads: {self.thread_response}",
                ephemeral=True,
            )
        except Exception as e:
            await interaction.response.send_message(
                f"**Error saving configuration:**\n\n{e}",
                ephemeral=True,
            )

    def construct_settings(self) -> dict[str, dict[str, str]]:
        return {
            self.channel_id: {
                "channel_response": self.channel_response,
                "thread_response": self.thread_response,
            }
        }
