"""Tests for Slack markdown postprocessing."""

from fai.utils.slack.postprocessing import (
    SlackifyMarkdown,
    slackify_markdown,
)


class TestSlackifyMarkdown:
    """Test the SlackifyMarkdown class."""

    def test_normalize_code_block_with_language_and_filename(self) -> None:
        """Test that code blocks with language and filename are normalized."""
        markdown = """Here's an example:
```yaml docs.yml
settings:
  http-snippets: true
```
"""
        expected = """Here's an example:
```
settings:
  http-snippets: true
```
"""
        converter = SlackifyMarkdown()
        result = converter.serialize(markdown)
        assert result == expected

    def test_normalize_code_block_with_language_only(self) -> None:
        """Test that code blocks with language identifier only are normalized."""
        markdown = """Example:
```python
def hello():
    print("Hello")
```
"""
        expected = """Example:
```
def hello():
    print("Hello")
```
"""
        converter = SlackifyMarkdown()
        result = converter.serialize(markdown)
        assert result == expected

    def test_normalize_code_block_with_title(self) -> None:
        """Test that code blocks with title attribute are normalized."""
        markdown = """Example:
```python title="hello.py"
def hello():
    print("Hello")
```
"""
        expected = """Example:
```
def hello():
    print("Hello")
```
"""
        converter = SlackifyMarkdown()
        result = converter.serialize(markdown)
        assert result == expected

    def test_normalize_multiple_code_blocks_with_different_formats(self) -> None:
        """Test normalizing multiple code blocks with different formats."""
        markdown = """First example:
```yaml docs.yml
key: value
```

Second example:
```typescript
const x = 1;
```

Third example:
```python title="script.py"
print("hello")
```
"""
        expected = """First example:
```
key: value
```

Second example:
```
const x = 1;
```

Third example:
```
print("hello")
```
"""
        converter = SlackifyMarkdown()
        result = converter.serialize(markdown)
        assert result == expected

    def test_headings_converted_to_bold(self) -> None:
        """Test that markdown headings are converted to bold text."""
        markdown = "# Heading 1\n## Heading 2"
        expected = "*Heading 1*\n*Heading 2*"
        converter = SlackifyMarkdown()
        result = converter.serialize(markdown)
        assert result == expected

    def test_links_converted_to_slack_format(self) -> None:
        """Test that markdown links are converted to Slack format."""
        markdown = "[Click here](https://example.com)"
        expected = "<https://example.com|Click here>"
        converter = SlackifyMarkdown()
        result = converter.serialize(markdown)
        assert result == expected

    def test_bold_text_conversion(self) -> None:
        """Test that markdown bold is converted to Slack bold."""
        markdown = "**bold text** and __also bold__"
        expected = "*bold text* and *also bold*"
        converter = SlackifyMarkdown()
        result = converter.serialize(markdown)
        assert result == expected

    def test_slackify_markdown_function(self) -> None:
        """Test the convenience function."""
        markdown = """# Title
```yaml docs.yml
settings:
  http-snippets: true
```
[Link](https://example.com)
"""
        result = slackify_markdown(markdown)
        assert "```yaml docs.yml" not in result
        assert "```\nsettings:" in result
        assert "<https://example.com|Link>" in result
        assert "*Title*" in result
