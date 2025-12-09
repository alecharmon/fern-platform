from enum import Enum


class LanguageModel(str, Enum):
    claude_sonnet_4 = "claude-4-sonnet"
    command_a = "command-a-03-2025"
    claude_haiku_4_5 = "claude-4.5-haiku"
    claude_sonnet_4_5 = "claude-4.5-sonnet"
