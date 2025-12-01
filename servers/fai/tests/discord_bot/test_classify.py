from unittest.mock import (
    AsyncMock,
    patch,
)

import pytest

from discord_bot.message.classify import (
    DiscordMessageClassification,
    classify_message,
)


def create_classification_mock(classification: str, reasoning: str = "Mock reasoning") -> DiscordMessageClassification:
    """Helper to create a mock classification response."""
    return DiscordMessageClassification(classification=classification, reasoning=reasoning)


@pytest.mark.asyncio
class TestClassifyMessage:
    """Test the Discord message classification system."""

    async def test_classify_direct_question(self) -> None:
        """Questions with interrogative words should be classified as 'question'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("question")
            result = await classify_message("How do I authenticate with the API?")
            assert result == "question"

    async def test_classify_help_request(self) -> None:
        """Help requests should be classified as 'question'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("question")
            result = await classify_message("I need help setting up webhooks")
            assert result == "question"

    async def test_classify_greeting(self) -> None:
        """Casual greetings should be classified as 'ignore'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("ignore")
            result = await classify_message("hey everyone!")
            assert result == "ignore"

    async def test_classify_thanks(self) -> None:
        """Thank you messages should be classified as 'ignore'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("ignore")
            result = await classify_message("thanks for the help!")
            assert result == "ignore"

    async def test_classify_off_topic(self) -> None:
        """Off-topic chat should be classified as 'ignore'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("ignore")
            result = await classify_message("anyone want to grab lunch?")
            assert result == "ignore"

    async def test_classify_with_user_mention(self) -> None:
        """Messages mentioning other users should be classified as 'ignore'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("ignore")
            result = await classify_message("Hey <@12345> can you help me with this?", bot_user_id="67890")
            assert result == "ignore"

    async def test_classify_with_bot_mention(self) -> None:
        """Messages mentioning the bot should be classified as 'question'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("question")
            result = await classify_message("Hey <@67890> how do I use the API?", bot_user_id="67890")
            assert result == "question"

    async def test_classify_statement_question(self) -> None:
        """Statements that clearly need information should be classified as 'question'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("question")
            result = await classify_message("I'm trying to implement OAuth but it's not working")
            assert result == "question"

    async def test_classify_with_thread_context(self) -> None:
        """Follow-up messages in a thread should consider context."""
        message_history = [
            {"role": "user", "content": "How do I authenticate?"},
            {"role": "assistant", "content": "You can use API keys or OAuth."},
        ]
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("question")
            result = await classify_message("What about refresh tokens?", message_history=message_history)
            assert result == "question"

    async def test_classify_social_in_thread(self) -> None:
        """Social messages in a thread should still be ignored."""
        message_history = [
            {"role": "user", "content": "How do I authenticate?"},
            {"role": "assistant", "content": "You can use API keys or OAuth."},
        ]
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("ignore")
            result = await classify_message("awesome, thanks!", message_history=message_history)
            assert result == "ignore"

    async def test_classify_technical_question_no_interrogative(self) -> None:
        """Technical questions without interrogative words should be classified as 'question'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("question")
            result = await classify_message("Getting a 401 error when calling /api/v1/users")
            assert result == "question"

    async def test_classify_error_message(self) -> None:
        """Error messages should be classified as 'question'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("question")
            result = await classify_message("TypeError: Cannot read property 'map' of undefined")
            assert result == "question"

    async def test_classify_directed_at_specific_person(self) -> None:
        """Questions directed at a specific person should be classified as 'ignore'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("ignore")
            result = await classify_message("<@12345> did you fix that bug yet?", bot_user_id="67890")
            assert result == "ignore"

    async def test_classify_multiple_mentions_without_bot(self) -> None:
        """Messages with multiple user mentions (not the bot) should be classified as 'ignore'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("ignore")
            result = await classify_message("<@12345> and <@54321> can you review this PR?", bot_user_id="67890")
            assert result == "ignore"

    async def test_classify_code_snippet_with_question(self) -> None:
        """Messages with code snippets and questions should be classified as 'question'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = create_classification_mock("question")
            result = await classify_message("```python\nresponse = requests.get(url)\n```\nWhy is this returning 404?")
            assert result == "question"

    async def test_classify_api_failure(self) -> None:
        """When API fails, should default to 'ignore'."""
        with patch("discord_bot.message.classify.generate_anthropic_generic_async", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = None  # Simulate API failure
            result = await classify_message("How do I use the API?")
            assert result == "ignore"
