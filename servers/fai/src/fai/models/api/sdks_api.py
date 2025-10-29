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


class AnalyzeCommitDiffResponse(BaseModel):
    message: str = Field(description="The AI-generated commit message summarizing the changes in the diff")
    version_bump: VersionBump = Field(
        description=(
            "The recommended semantic version bump: MAJOR for breaking changes, MINOR for new features, "
            "PATCH for bug fixes and other changes, NO_CHANGE for empty diffs"
        )
    )
