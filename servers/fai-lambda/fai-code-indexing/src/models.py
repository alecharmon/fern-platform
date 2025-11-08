from typing import (
    Literal,
    TypedDict,
)

from pydantic import BaseModel


class MarkdownFileDocument(TypedDict):
    """Document record for markdown file chunks."""

    file_path: str
    relative_path: str
    file_name: str
    github_url: str | None
    document: str
    chunk: str
    title: str
    url: str
    keywords: list[str]


class AnalysisResult(BaseModel):
    domain: str
    session_id: str | None
    status: Literal["success", "error"]
    error: str | None


class SetupRepoResult(BaseModel):
    domain: str
    session_id: str | None
    status: Literal["success", "error"]
    error: str | None


class CodeSearchResult(BaseModel):
    domain: str
    status: Literal["success"]


class IndexMarkdownResult(BaseModel):
    domain: str
    status: Literal["success", "error"]
    error: str | None
