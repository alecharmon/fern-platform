from unittest.mock import MagicMock

import discord
import pytest

from fai.models.types.channel_settings_type import DiscordChannelSettings
from src.message.message_handler import should_respond_to_message


@pytest.mark.asyncio
class TestShouldRespondToMessage:
    """Test the should_respond_to_message function with different response modes."""

    def _create_mock_message(
        self, content: str = "test message", bot_id: int = 999, mentioned_users: list[int] | None = None
    ) -> discord.Message:
        """Helper to create a mock Discord message."""
        message = MagicMock(spec=discord.Message)
        message.content = content
        message.guild = MagicMock()
        message.guild.me = MagicMock()
        message.guild.me.id = bot_id

        if mentioned_users is None:
            mentioned_users = []

        message.mentions = []
        for user_id in mentioned_users:
            user = MagicMock()
            user.id = user_id
            message.mentions.append(user)

        message.role_mentions = []
        return message

    async def test_mentions_only_mode_without_mention(self) -> None:
        """mentions_only mode should not respond without a bot mention."""
        settings = DiscordChannelSettings(channel_response="mentions_only")
        message = self._create_mock_message()

        result = await should_respond_to_message(settings, message, is_in_thread=False)
        assert result is False

    async def test_mentions_only_mode_with_bot_mention(self) -> None:
        """mentions_only mode should respond when bot is mentioned."""
        settings = DiscordChannelSettings(channel_response="mentions_only")
        message = self._create_mock_message(bot_id=999, mentioned_users=[999])
        message.guild.me.id = 999
        message.guild.me.name = "TestBot"
        message.mentions = [message.guild.me]

        result = await should_respond_to_message(settings, message, is_in_thread=False)
        assert result is True

    async def test_mentions_only_mode_with_other_user_mention(self) -> None:
        """mentions_only mode should not respond when only other users are mentioned."""
        settings = DiscordChannelSettings(channel_response="mentions_only")
        message = self._create_mock_message(bot_id=999, mentioned_users=[123])

        result = await should_respond_to_message(settings, message, is_in_thread=False)
        assert result is False

    async def test_auto_mode_with_bot_mention(self) -> None:
        """auto mode should always respond when bot is mentioned."""
        settings = DiscordChannelSettings(channel_response="auto")
        message = self._create_mock_message(bot_id=999, mentioned_users=[999])
        message.guild.me.id = 999
        message.guild.me.name = "TestBot"
        message.mentions = [message.guild.me]

        result = await should_respond_to_message(settings, message, is_in_thread=False)
        assert result is True

    async def test_response_mode_respects_other_user_mentions(self) -> None:
        """All modes should ignore messages mentioning other users."""
        for mode in ["mentions_only", "auto"]:
            settings = DiscordChannelSettings(channel_response=mode)
            message = self._create_mock_message(bot_id=999, mentioned_users=[123])

            result = await should_respond_to_message(settings, message, is_in_thread=False)
            assert result is False, f"Mode {mode} should ignore messages with other user mentions"

    async def test_auto_mode_responds_to_questions(self) -> None:
        """Auto mode should use AI to respond to questions in both channels and threads."""
        settings = DiscordChannelSettings(channel_response="auto")

        question_message = self._create_mock_message(content="How do I use the API?")

        result_channel = await should_respond_to_message(settings, question_message, is_in_thread=False)
        assert result_channel is True, "Auto mode should respond to questions in channels"

        result_thread = await should_respond_to_message(settings, question_message, is_in_thread=True)
        # Same behavior in threads
        assert result_thread is True, "Auto mode should respond to questions in threads"
