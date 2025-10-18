import discord
from sqlalchemy import update

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
        try:
            async with async_session_maker() as session:
                await session.execute(
                    update(DiscordIntegrationDb)
                    .where(DiscordIntegrationDb.discord_guild_id == str(interaction.guild.id))
                    .values(settings=self.construct_settings())
                )
                await session.commit()

            help_mention_text = "Not set"
            if self.help_role_id:
                role = interaction.guild.get_role(int(self.help_role_id))
                if role:
                    help_mention_text = role.mention
                else:
                    member = interaction.guild.get_member(int(self.help_role_id))
                    if member:
                        help_mention_text = member.mention

            await interaction.response.edit_message(view=None, content="**Configure Ask Fern:**")

            message_text = (
                f"**Configuration saved!**\n\n"
                f"**Response mode:** {self.channel_response}\n\n"
                f"**Help Mention:**\n"
                f"• {help_mention_text}"
            )

            await interaction.followup.send(message_text, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(
                f"**Error saving configuration:**\n\n{e}",
                ephemeral=True,
            )

    def construct_settings(self) -> dict[str, dict[str, str | None]]:
        settings: dict[str, str | None] = {
            "channel_response": self.channel_response,
        }
        if self.help_role_id:
            settings["help_role_id"] = self.help_role_id
        return {self.channel_id: settings}
