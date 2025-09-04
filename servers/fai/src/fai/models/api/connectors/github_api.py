from pydantic import (
    BaseModel,
    Field,
    HttpUrl,
)


class GitHubFileInfoRequest(BaseModel):
    url: HttpUrl = Field(description="The GitHub repository URL (e.g., https://github.com/owner/repo)")


class GitHubFileInfo(BaseModel):
    name: str = Field(description="The name of the file")
    path: str = Field(description="The relative path of the file in the repository")
    size: int = Field(description="The size of the file in bytes")
    html_url: str = Field(description="The URL to the file in the browser")
    type: str = Field(default="file")
    content: str = Field(description="The content of the file as a base64 encoded string.")
    encoding: str = Field(description="The encoding of the file")


class ReferenceSnippet(BaseModel):
    method_header: str = Field(description="The header of the method or function, e.g., 'def foo(bar):'")
    language: str | None = Field(default=None, description="The language of the code snippet")
    description: str | None = Field(default=None, description="A description of what the method does")
    usage: str | None = Field(default=None, description="A code snippet showing how to use the method")
    parameters: list[str] | None = Field(default=None, description="A list of parameter names for the method")


class CodeIndexStatusResponse(BaseModel):
    exists: bool = Field(description="Whether the domain has a non-empty code index")


class IndexResponse(BaseModel):
    success: bool = Field(description="Whether the index operation was successful")
