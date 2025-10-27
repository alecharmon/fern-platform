import discord
from sqlalchemy import (
    select,
)
from sqlalchemy.orm import attributes

from fai.db import async_session_maker
from fai.models.db.discord_integration_db import DiscordIntegrationDb
from fai.settings import LOGGER


class ConfigureView(discord.ui.View):
    def __init__(
        self,
        channel_id: str,
        channel_response: str = "mentions_only",
        help_role_id: str | None = None,
    ):
        super().__init__()
        self.channel_id = channel_id
        self.channel_response = channel_response
        self.help_role_id = help_role_id

    @discord.ui.select(
        placeholder="Select response mode",
        options=[
            discord.SelectOption(
                label="Mentions only", value="mentions_only", description="respond only when bot is mentioned"
            ),
            discord.SelectOption(label="Auto", value="auto", description="respond to questions, ignore casual chat"),
        ],
        row=0,
    )
    async def channel_select(self, interaction: discord.Interaction, select: discord.ui.Select) -> None:
        self.channel_response = select.values[0]
        await interaction.response.defer()

    @discord.ui.select(
        cls=discord.ui.MentionableSelect,
        placeholder="Select a role to tag when users click 'Ask for help' (optional)",
        max_values=1,
        row=1,
    )
    async def help_role_select(self, interaction: discord.Interaction, select: discord.ui.MentionableSelect) -> None:
        self.help_role_id = str(select.values[0].id) if select.values else None
        LOGGER.info(f"Help role/user selected: {self.help_role_id}")
        await interaction.response.defer()

    @discord.ui.button(label="Save Configuration", style=discord.ButtonStyle.primary, row=2)
    async def save_config(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await interaction.response.defer()
        try:
            new_settings = await self.construct_settings(str(interaction.guild.id))
            async with async_session_maker() as session:
                result = await session.execute(
                    select(DiscordIntegrationDb).where(
                        DiscordIntegrationDb.discord_guild_id == str(interaction.guild.id)
                    )
                )
                integration = result.scalar_one_or_none()
                if integration:
                    integration.settings = new_settings
                    attributes.flag_modified(integration, "settings")
                    await session.commit()
                    LOGGER.info(f"Saved settings for guild {interaction.guild.id}: {new_settings}")
                else:
                    LOGGER.error(f"No integration found for guild {interaction.guild.id}")
                    await interaction.followup.send(
                        "**Error:** Integration not found for this server.",
                        ephemeral=True,
                    )
                    return

            help_mention_text = "Not set"
            if self.help_role_id:
                role = interaction.guild.get_role(int(self.help_role_id))
                if role:
                    help_mention_text = role.mention
                else:
                    member = interaction.guild.get_member(int(self.help_role_id))
                    if member:
                        help_mention_text = member.mention

            message_text = (
                f"**Configuration saved!**\n\n"
                f"**Response mode:** {self.channel_response}\n\n"
                f"**Help Mention:**\n"
                f"• {help_mention_text}"
            )

            await interaction.edit_original_response(view=None, content=message_text)
        except Exception as e:
            LOGGER.exception("Failed to save configuration")
            await interaction.followup.send(
                f"**Error saving configuration:**\n\n{e}",
                ephemeral=True,
            )

    async def construct_settings(self, guild_id: str) -> dict[str, dict[str, str | None]]:
        async with async_session_maker() as session:
            result = await session.execute(
                select(DiscordIntegrationDb).where(DiscordIntegrationDb.discord_guild_id == guild_id)
            )
            integration = result.scalar_one_or_none()
            existing_settings = integration.settings if integration and integration.settings else {}

        settings: dict[str, str | None] = {
            "channel_response": self.channel_response,
        }
        if self.help_role_id:
            settings["help_role_id"] = self.help_role_id

        merged_settings = {**existing_settings, self.channel_id: settings}
        return merged_settings
