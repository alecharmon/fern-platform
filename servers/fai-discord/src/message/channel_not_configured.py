import discord

from fai.models.types.channel_settings_type import ChannelSettings

NOT_CONFIGURED_MESSAGE = """**Ask AI not configured for this channel**
Use command `/configure` in the desired channel to proceed."""


async def channel_not_configured(
    channel_settings: ChannelSettings | None, message: discord.Message, is_in_thread: bool
) -> None:
    if channel_settings is None:
        if is_in_thread:
            await message.channel.send(NOT_CONFIGURED_MESSAGE, suppress_embeds=True)
        elif message.thread:
            await message.thread.send(NOT_CONFIGURED_MESSAGE, suppress_embeds=True)
        else:
            thread = await message.create_thread(name="Ask Fern - Configuration Required")
            await thread.send(NOT_CONFIGURED_MESSAGE, suppress_embeds=True)
    return None
