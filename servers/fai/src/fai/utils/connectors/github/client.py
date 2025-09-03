import base64
import re
from urllib.parse import urlparse

import requests

from src.fai.models.api.connectors.github_api import (
    GitHubFileInfo,
    GitHubFileInfoRequest,
    ReferenceSnippet,
)
from src.fai.utils.connectors.github.constants import (
    DESCRIPTION_SECTION_PATTERN,
    METHOD_HEADER_GROUPS_PATTERN,
    METHOD_HEADER_PATTERN,
    PARAMETERS_SECTION_PATTERN,
    SUPPORTED_LANGUAGES,
    USAGE_SECTION_PATTERN,
)
from src.settings import LOGGER


class GitHubClient:
    """Service for retrieving source code from GitHub repositories."""

    def __init__(self, github_token: str | None = None):
        """Initialize GitHub service with optional token for API rate limiting."""
        self.github_token = github_token
        self.api_base_url = "https://api.github.com"
        self.headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        self.reference_md_file_name = "reference.md"

        if github_token:
            self.headers["Authorization"] = f"Bearer {github_token}"

    def _parse_github_url(self, url: str) -> tuple[str, str]:
        """Parse GitHub URL to extract owner and repo name."""
        parsed = urlparse(str(url))
        if parsed.netloc != "github.com":
            raise ValueError("URL must be a GitHub repository URL")

        path_parts = parsed.path.strip("/").split("/")
        if len(path_parts) < 2:
            raise ValueError("Invalid GitHub repository URL format")

        owner = path_parts[0]
        repo = path_parts[1].replace(".git", "")  # Remove .git suffix if present

        return owner, repo

    def _get_file_content(self, owner: str, repo: str, file_path: str) -> GitHubFileInfo | None:
        """Get the content of a specific file from the repository."""
        url = f"{self.api_base_url}/repos/{owner}/{repo}/contents/{file_path}"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()

            file_data = response.json()

            # Handle files that are too large or binary
            if file_data.get("size", 0) == 0:
                return None

            # Decode base64 content
            content_b64 = file_data.get("content", "")
            if not content_b64:
                return None

            try:
                content_bytes = base64.b64decode(content_b64)
                content = content_bytes.decode("utf-8")
                encoding = "utf-8"
            except UnicodeDecodeError:
                # Handle binary files
                content = f"[Binary file: {file_data.get('size', 0)} bytes]"
                encoding = "binary"

            return GitHubFileInfo(
                name=file_data.get("name", ""),
                html_url=file_data.get("html_url", ""),
                type=file_data.get("type", "file"),
                path=file_path,
                content=content,
                size=file_data.get("size", 0),
                encoding=encoding,
            )

        except requests.RequestException as e:
            LOGGER.warning(f"Failed to fetch file {file_path}: {e}")
            return None

    def _parse_method_header_groups(self, usage_snippet: str) -> str:
        """Parse method header groups from a raw method header."""

        method_header_match = re.search(METHOD_HEADER_PATTERN, usage_snippet, re.DOTALL)
        raw_method_header = method_header_match.group(1).strip() if method_header_match else ""

        if raw_method_header:
            method_header_groups = re.search(METHOD_HEADER_GROUPS_PATTERN, raw_method_header)
            if method_header_groups and len(method_header_groups.groups()) >= 4:
                return (
                    (method_header_groups.group(1) or "")
                    + (method_header_groups.group(3) or "")
                    + (method_header_groups.group(4) or "")
                )
            else:
                return raw_method_header
        else:
            return ""

    def _parse_description_section(self, usage_snippet: str) -> str:
        """Parse description section from a raw description section."""
        desc_section_match = re.search(DESCRIPTION_SECTION_PATTERN, usage_snippet, re.DOTALL)
        if desc_section_match:
            desc_section = desc_section_match.group(1)
            if desc_section:
                desc_match = re.search(
                    r"\s*<dl>\s*<dd>\s*<dl>\s*<dd>\s*(.*?)\s*</dd>\s*</dl>\s*</dd>\s*</dl>\s*", desc_section, re.DOTALL
                )
                if desc_match and desc_match.group(1):
                    return desc_match.group(1).strip()
        return ""

    def _parse_usage_section(self, usage_snippet: str) -> tuple[str, str]:
        """Parse usage section from a raw usage section."""
        usage_section_match = re.search(USAGE_SECTION_PATTERN, usage_snippet, re.DOTALL)
        if usage_section_match:
            usage_section = usage_section_match.group(1)
            if usage_section:
                usage_match = re.search(
                    r"```(" + "|".join(SUPPORTED_LANGUAGES) + r")\s*(.*?)```", usage_section, re.DOTALL
                )
                if usage_match:
                    return (usage_match.group(2).strip() or ""), (usage_match.group(1).strip() or "")
        return "", ""

    def _parse_parameters_section(self, usage_snippet: str) -> list[str]:
        """Parse parameters section from a raw parameters section."""
        params_section_match = re.search(PARAMETERS_SECTION_PATTERN, usage_snippet, re.DOTALL)
        if params_section_match:
            params_section_content = params_section_match.group(1)
            if params_section_content:
                raw_parameters = re.findall(
                    r"\s*<dl>\s*<dd>\s*(.*?)\s*</dd>\s*</dl>\s*", params_section_content, re.DOTALL
                )
                parameters = [param.strip() for param in raw_parameters if param and param.strip()]
                return parameters
        return []

    def parse_usage_snippet(self, usage_snippet: str) -> ReferenceSnippet | None:
        if not usage_snippet:
            return None

        method_header = self._parse_method_header_groups(usage_snippet)
        description = self._parse_description_section(usage_snippet)
        usage, language = self._parse_usage_section(usage_snippet)
        parameters = self._parse_parameters_section(usage_snippet)

        return ReferenceSnippet(
            method_header=method_header, description=description, usage=usage, parameters=parameters, language=language
        )

    def retrieve_reference_md_source(self, request: GitHubFileInfoRequest) -> GitHubFileInfo | None:
        """Retrieve reference.md file from a GitHub repository."""
        try:
            owner, repo = self._parse_github_url(str(request.url))
            return self._get_file_content(owner, repo, self.reference_md_file_name)
        except Exception as e:
            LOGGER.error(f"Failed to retrieve reference.md file: {e}")
            raise

    def extract_usage_snippets(self, file_info: GitHubFileInfo) -> list[ReferenceSnippet]:
        """Extract usage snippets from a reference.md file."""
        usage_snippets = re.findall(r"<details>(.*?)</details>", file_info.content, re.DOTALL)
        parsed_usage_snippets = []
        for usage_snippet in usage_snippets:
            snippet = self.parse_usage_snippet(usage_snippet)
            if snippet:
                parsed_usage_snippets.append(snippet)
        return parsed_usage_snippets
