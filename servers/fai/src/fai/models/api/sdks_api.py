from enum import Enum

from pydantic import (
    BaseModel,
    Field,
)


class VersionBump(str, Enum):
    MAJOR = "MAJOR"
    MINOR = "MINOR"
    PATCH = "PATCH"
    NO_CHANGE = "NO_CHANGE"


class AnalyzeCommitDiffRequest(BaseModel):
    diff: str = Field(description="The git diff to analyze for generating a commit message")
    language: str | None = Field(
        default=None,
        description="The SDK programming language, e.g. 'typescript', 'python', 'java'. "
        "When provided, enables language-specific breaking change rules and behavioral analysis.",
    )
    previous_version: str | None = Field(
        default=None,
        description="The current published version before this change, e.g. '1.2.3'. "
        "Provided for context only — not included in the commit message.",
    )
    prior_changelog: str | None = Field(
        default=None,
        description="The last 3 changelog entries for this SDK. "
        "Used to match existing commit message style. Empty string or null if none.",
    )
    spec_commit_message: str | None = Field(
        default=None,
        description="The commit message from the API spec repository that triggered this SDK generation. "
        "Used as a hint for the intent of the change. Empty string or null if unavailable.",
    )


class ConsolidateChangelogRequest(BaseModel):
    raw_entries: str = Field(
        description="Newline-separated raw changelog entries from chunked diff analysis",
    )
    version_bump: str = Field(
        description="The overall version bump: MAJOR, MINOR, or PATCH",
    )
    language: str = Field(
        default="unknown",
        description="The SDK programming language, e.g. 'typescript', 'python', 'java'",
    )


class ConsolidateChangelogResponse(BaseModel):
    consolidated_changelog: str = Field(
        description=(
            "CHANGELOG.md entry in Keep a Changelog format. Group under ### Breaking Changes, "
            "### Added, ### Changed, ### Fixed. Bold symbol names, one tight sentence per bullet. "
            "Prose only, no code fences. Append migration action inline for breaking changes."
        ),
    )
    pr_description: str = Field(
        default="",
        description=(
            "PR description with ## Breaking Changes section (if any) containing ### per breaking "
            "change with Before/After code fences and Migration line, then ## What's New section "
            "summarizing features in prose paragraphs grouped by theme. "
            "Do NOT list every class individually - summarize repetitive changes as a single entry."
        ),
    )
    version_bump_reason: str = Field(
        default="",
        description=(
            "One sentence explaining WHY the overall version bump was chosen. "
            "For MAJOR: name the specific breaking symbol(s). For MINOR: name the new capability. "
            "For PATCH: describe the fix. "
            "Example: 'MAJOR because `parserCreateJob` InputStream overloads were removed from `RawLabReportClient`.'"
        ),
    )


class AnalyzeCommitDiffResponse(BaseModel):
    message: str = Field(description="The AI-generated commit message summarizing the changes in the diff")
    changelog_entry: str = Field(
        default="",
        description=(
            "User-facing release note for CHANGELOG.md and GitHub Releases. "
            "Describes the impact on SDK consumers, not implementation details. "
            "Empty string for PATCH and NO_CHANGE."
        ),
    )
    version_bump: VersionBump = Field(
        description=(
            "The recommended semantic version bump: MAJOR for breaking changes, MINOR for new features, "
            "PATCH for bug fixes and other changes, NO_CHANGE for empty diffs"
        )
    )
    version_bump_reason: str = Field(
        default="",
        description=(
            "One sentence explaining WHY this version bump was chosen. "
            "For MAJOR: name the specific breaking symbol(s). For MINOR: name the new capability. "
            "For PATCH: describe the fix. For NO_CHANGE: 'No functional changes detected.'"
        ),
    )
