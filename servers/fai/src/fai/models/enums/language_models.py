from enum import Enum


class LanguageModel(str, Enum):
    claude_sonnet_4 = "claude-4-sonnet-20250514"
    command_a = "command-a-03-2025"
    claude_haiku_4_5 = "claude-haiku-4-5-20251001"
    claude_sonnet_4_5 = "claude-sonnet-4-5-20250929"
