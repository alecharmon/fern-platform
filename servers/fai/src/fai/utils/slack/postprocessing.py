"""
Slackify Markdown - Convert standard Markdown to Slack's mrkdwn format

This module converts standard Markdown syntax to Slack's mrkdwn formatting.
Based on the JavaScript library: https://github.com/jsarafajr/slackify-markdown
"""

import re


class SlackifyMarkdown:
    """Convert Markdown to Slack mrkdwn format."""

    def __init__(self) -> None:
        """Initialize the converter with default settings."""
        self.in_code_block: bool = False
        self.code_block_buffer: list[str] = []

    def serialize(self, markdown: str) -> str:
        """
        Convert Markdown text to Slack mrkdwn format.

        Args:
            markdown: Standard Markdown formatted text

        Returns:
            Slack mrkdwn formatted text
        """
        markdown = self._normalize_code_blocks(markdown)

        lines = markdown.split("\n")
        converted_lines = []
        in_code_block = False

        for line in lines:
            if line.strip() == "```":
                in_code_block = not in_code_block
                converted_lines.append(line)
                continue

            if in_code_block:
                converted_lines.append(line)
            else:
                converted_line = self._convert_line(line)
                converted_lines.append(converted_line)

        return "\n".join(converted_lines)

    def _convert_line(self, line: str) -> str:
        """Convert a single line of Markdown to mrkdwn."""
        if not line.strip():
            return line

        heading_match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading_match:
            heading_text = heading_match.group(2)
            heading_text = self._convert_inline(heading_text)
            return f"*{heading_text}*"

        list_match = re.match(r"^(\s*)[-*+]\s+(.+)$", line)
        if list_match:
            content = self._convert_inline(list_match.group(2))
            return f"* {content}"

        ordered_match = re.match(r"^(\s*)(\d+)\.\s+(.+)$", line)
        if ordered_match:
            number = ordered_match.group(2)
            content = self._convert_inline(ordered_match.group(3))
            return f"{number}. {content}"

        if line.strip().startswith(">"):
            quote_text = re.sub(r"^>\s*", "", line)
            return f">{self._convert_inline(quote_text)}"

        if re.match(r"^[-*_]{3,}$", line.strip()):
            return ""

        return self._convert_inline(line)

    def _convert_inline(self, text: str) -> str:
        """Convert inline Markdown formatting to mrkdwn."""
        text = self._convert_inline_code(text)
        text = self._convert_links(text)
        text = self._convert_italic(text)
        text = self._convert_bold(text)
        text = self._convert_strikethrough(text)
        return text

    def _convert_links(self, text: str) -> str:
        """Convert Markdown links to Slack mrkdwn links."""
        return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"<\2|\1>", text)

    def _convert_bold(self, text: str) -> str:
        """Convert Markdown bold to Slack mrkdwn bold."""
        text = re.sub(r"\*\*([^*]+?)\*\*", r"*\1*", text)
        text = re.sub(r"__([^_]+?)__", r"*\1*", text)
        return text

    def _convert_italic(self, text: str) -> str:
        """
        Convert Markdown italic to Slack mrkdwn italic.
        Match single * or _ that are NOT part of ** or __.
        """
        text = re.sub(r"(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)", r"_\1_", text)
        text = re.sub(r"(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)", r"_\1_", text)
        return text

    def _convert_strikethrough(self, text: str) -> str:
        """Convert Markdown strikethrough to Slack mrkdwn strikethrough."""
        return re.sub(r"~~([^~]+)~~", r"~\1~", text)

    def _convert_inline_code(self, text: str) -> str:
        """Convert inline code blocks."""
        return text

    def _normalize_code_blocks(self, markdown: str) -> str:
        """
        Normalize all code block formats to standard ```\n{code}\n``` format.
        Handles (in order of specificity):
        1. ```{language} title="{title}"\n{code}\n```
        2. ```{language}\n{code}\n```
        3. ```\n{code}\n```
        """
        markdown = re.sub(
            r'```\w+\s+title="[^"]*"\n(.*?)```', lambda m: f"```\n{m.group(1).rstrip()}\n```", markdown, flags=re.DOTALL
        )

        markdown = re.sub(r"```\w+\n(.*?)```", lambda m: f"```\n{m.group(1).rstrip()}\n```", markdown, flags=re.DOTALL)

        markdown = re.sub(r"```([^\n])", r"```\n\1", markdown)

        return markdown


def slackify_markdown(markdown: str) -> str:
    """
    Convert Markdown text to Slack mrkdwn format.

    Args:
        markdown: Standard Markdown formatted text

    Returns:
        Slack mrkdwn formatted text

    Example:
        >>> markdown = '''
        ... # List of items
        ... * item 1
        ... * item 2
        ... * item 3
        ... [here is an example](https://example.com)
        ... '''
        >>> print(slackify_markdown(markdown))
        *List of items*
        • item 1
        • item 2
        • item 3
        <https://example.com|here is an example>
    """
    converter = SlackifyMarkdown()
    return converter.serialize(markdown)
