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
    """Request to analyze a generated SDK diff and produce a version bump recommendation.

    Terminology:
    - "SDK changelog" = user-facing release notes shipped with the generated SDK
      (e.g. CHANGELOG.md in the SDK repo, GitHub Releases body).
    - "generator release changelog" = internal Fern tracking of generator version
      changes (stored in versions.yml inside each generator directory).
    This endpoint produces SDK changelog entries, NOT generator release changelogs.
    """

    diff: str = Field(description="The git diff of the generated SDK to analyze")
    language: str | None = Field(
        default=None,
        description="The SDK programming language, e.g. 'typescript', 'python', 'java'. "
        "When provided, enables language-specific breaking change rules and behavioral analysis.",
    )
    previous_version: str | None = Field(
        default=None,
        description="The current published SDK version before this change, e.g. '1.2.3'. "
        "Provided for context only — not included in the commit message.",
    )
    prior_changelog: str | None = Field(
        default=None,
        description="The last few SDK changelog entries (from the SDK repo's CHANGELOG.md). "
        "Used to match existing tone and format. Empty string or null if none.",
    )
    spec_commit_message: str | None = Field(
        default=None,
        description="The commit message from the API spec repository that triggered this SDK generation. "
        "Used as a hint for understanding the intent of the change. Empty string or null if unavailable.",
    )


class ConsolidateChangelogRequest(BaseModel):
    """Request to consolidate multiple per-chunk SDK changelog entries into one.

    When a large diff is split into chunks, each chunk produces its own SDK
    changelog entry.  This endpoint merges them into a single deduplicated
    entry suitable for the SDK's CHANGELOG.md.
    """

    raw_entries: str = Field(
        description="Newline-separated raw SDK changelog entries from chunked diff analysis",
    )
    version_bump: str = Field(
        description="The overall version bump: MAJOR, MINOR, or PATCH",
    )
    language: str = Field(
        default="unknown",
        description="The SDK programming language, e.g. 'typescript', 'python', 'java'",
    )


class ConsolidateChangelogResponse(BaseModel):
    """Consolidated SDK changelog and PR description produced from chunked analysis."""

    consolidated_changelog: str = Field(
        description=(
            "SDK CHANGELOG.md entry in Keep a Changelog format. Group under ### Breaking Changes, "
            "### Added, ### Changed, ### Fixed. Bold symbol names, one tight sentence per bullet. "
            "Prose only, no code fences. Append migration action inline for breaking changes."
        ),
    )
    pr_description: str = Field(
        default="",
        description=(
            "PR description for the SDK repo. ## Breaking Changes section (if any) with "
            "### per breaking change with Before/After code fences and Migration line, "
            "then ## What's New section summarizing features in prose paragraphs grouped by theme. "
            "Do NOT list every class individually — summarize repetitive changes as a single entry."
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
    """AI analysis result for a generated SDK diff.

    The ``changelog_entry`` field contains a user-facing SDK release note
    (for the SDK repo's CHANGELOG.md / GitHub Releases), NOT a generator
    release changelog entry (which lives in versions.yml).
    """

    message: str = Field(description="AI-generated commit message for the SDK repo")
    changelog_entry: str = Field(
        default="",
        description=(
            "User-facing SDK release note for CHANGELOG.md and GitHub Releases. "
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
