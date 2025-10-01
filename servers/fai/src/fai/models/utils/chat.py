from enum import Enum
from typing import Any

from turbopuffer.types.row import Row


class ChatMode(str, Enum):
    MARKDOWN = "markdown"
    SLACK_CHAT = "slack_chat"
    SLACK_INDEX = "slack_index"
    DISCORD = "discord"


def format_record(record: Row | Any) -> str:
    document = getattr(record, "chunk", "")
    url = getattr(record, "url", "")

    if url:
        return f"{document}\nSource: {url}"
    return document
