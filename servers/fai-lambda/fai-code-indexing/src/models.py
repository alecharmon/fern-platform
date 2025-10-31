from typing import Literal

from pydantic import BaseModel


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
