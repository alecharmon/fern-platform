from enum import Enum


class LanguageModel(str, Enum):
    claude_4 = "claude-4-sonnet-20250514"
    command_a = "command-a-03-2025"
