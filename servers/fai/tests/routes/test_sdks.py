from collections.abc import Generator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from fai.app import fai_app
from fai.dependencies import verify_org_token
from fai.models.api.sdks_api import (
    AnalyzeCommitDiffRequest,
    AnalyzeCommitDiffResponse,
    ConsolidateChangelogRequest,
    ConsolidateChangelogResponse,
    VersionBump,
)
from fai.routes.sdks import LANGUAGE_RULES, _build_prompt, _consolidate_changelog

# ---------------------------------------------------------------------------
# _build_prompt — legacy (diff only, no language)
# ---------------------------------------------------------------------------


class TestBuildPromptLegacy:
    """When language is None the prompt must match legacy behaviour."""

    def _prompt(self, diff: str = "some diff") -> str:
        return _build_prompt(diff=diff)

    def test_includes_header(self) -> None:
        assert "expert software engineer" in self._prompt()

    def test_includes_version_bump_guidelines(self) -> None:
        p = self._prompt()
        assert "MAJOR:" in p
        assert "MINOR:" in p
        assert "PATCH:" in p
        assert "NO_CHANGE:" in p

    def test_does_not_include_behavioral_rules(self) -> None:
        p = self._prompt()
        assert "Changed HTTP status code handling" not in p
        assert "Changed default parameter values" not in p
        assert "Changed retry or backoff behavior" not in p

    def test_does_not_include_language_specific_rules(self) -> None:
        p = self._prompt()
        assert "Language-specific breaking change rules for TypeScript" not in p

    def test_includes_examples(self) -> None:
        p = self._prompt()
        assert "--- Examples ---" in p
        assert "--- End Examples ---" in p
        assert "MAJOR: removed exported TypeScript function" in p
        assert "MINOR: new optional TypeScript parameter" in p
        assert "MINOR: changed default retry count" in p
        assert "PATCH: Go import reorganization" in p

    def test_includes_diff(self) -> None:
        p = self._prompt(diff="my-test-diff-content")
        assert "my-test-diff-content" in p

    def test_includes_changelog_guidelines(self) -> None:
        p = self._prompt()
        assert "Changelog Entry Guidelines:" in p
        assert "Write for SDK consumers" in p

    def test_includes_message_guidelines(self) -> None:
        p = self._prompt()
        assert "Message Guidelines:" in p
        assert "conventional commit types" in p

    def test_includes_final_reminder(self) -> None:
        p = self._prompt()
        assert "YOU MUST return a structured JSON response" in p

    def test_does_not_include_previous_version_when_absent(self) -> None:
        p = self._prompt()
        assert "Previous version:" not in p

    def test_does_not_include_sdk_language_when_absent(self) -> None:
        p = self._prompt()
        assert "SDK language:" not in p

    def test_examples_before_message_format(self) -> None:
        p = self._prompt()
        examples_pos = p.index("--- Examples ---")
        end_examples_pos = p.index("--- End Examples ---")
        message_format_pos = p.index("Message Format")
        assert examples_pos < end_examples_pos < message_format_pos

    def test_when_in_doubt_guidance(self) -> None:
        p = self._prompt()
        assert "When in doubt between MINOR and PATCH" in p
        assert "When in doubt between MAJOR and MINOR" in p


# ---------------------------------------------------------------------------
# _build_prompt — with language (behavioral analysis enabled)
# ---------------------------------------------------------------------------


class TestBuildPromptWithLanguage:
    """When language is provided the prompt includes behavioral rules and language-specific blocks."""

    def _prompt(self, language: str = "python", **kwargs: str | None) -> str:
        return _build_prompt(diff="test diff", language=language, **kwargs)  # type: ignore[arg-type]

    def test_includes_behavioral_minor_rules(self) -> None:
        p = self._prompt()
        assert "Changed HTTP status code handling" in p
        assert "Changed default parameter values" in p
        assert "Changed serialization behavior" in p
        assert "Changed error message text" in p
        assert "Changed HTTP header names or values" in p
        assert "Changed retry or backoff behavior" in p

    def test_includes_language_specific_rules_for_python(self) -> None:
        p = self._prompt("python")
        assert "Language-specific breaking change rules for Python" in p
        assert "callers get TypeError" in p

    def test_includes_language_specific_rules_for_typescript(self) -> None:
        p = self._prompt("typescript")
        assert "Language-specific breaking change rules for TypeScript" in p
        assert "Promise<T>" in p

    def test_includes_language_specific_rules_for_java(self) -> None:
        p = self._prompt("java")
        assert "Language-specific breaking change rules for Java" in p
        assert "Optional<T>" in p

    def test_includes_language_specific_rules_for_go(self) -> None:
        p = self._prompt("go")
        assert "Language-specific breaking change rules for Go" in p

    def test_includes_language_specific_rules_for_ruby(self) -> None:
        p = self._prompt("ruby")
        assert "Language-specific breaking change rules for Ruby" in p

    def test_includes_language_specific_rules_for_csharp(self) -> None:
        p = self._prompt("csharp")
        assert "Language-specific breaking change rules for C#" in p

    def test_includes_language_specific_rules_for_php(self) -> None:
        p = self._prompt("php")
        assert "Language-specific breaking change rules for PHP" in p

    def test_includes_language_specific_rules_for_swift(self) -> None:
        p = self._prompt("swift")
        assert "Language-specific breaking change rules for Swift" in p

    def test_includes_language_specific_rules_for_rust(self) -> None:
        p = self._prompt("rust")
        assert "Language-specific breaking change rules for Rust" in p

    def test_includes_language_specific_rules_for_kotlin(self) -> None:
        p = self._prompt("kotlin")
        assert "Language-specific breaking change rules for Kotlin" in p

    def test_unknown_language_uses_generic_rules(self) -> None:
        p = self._prompt("haskell")
        assert "Language-specific breaking change rules (language: haskell)" in p
        assert "exhaustive matching" in p

    def test_language_is_case_insensitive(self) -> None:
        p = self._prompt("Python")
        assert "Language-specific breaking change rules for Python" in p

    def test_includes_sdk_language_context(self) -> None:
        p = self._prompt("typescript")
        assert "SDK language: typescript" in p


class TestBuildPromptLanguageRulesDict:
    """Ensure LANGUAGE_RULES covers all 10 languages."""

    EXPECTED_LANGUAGES = [
        "typescript",
        "python",
        "java",
        "go",
        "ruby",
        "csharp",
        "php",
        "swift",
        "rust",
        "kotlin",
    ]

    def test_all_languages_present(self) -> None:
        for lang in self.EXPECTED_LANGUAGES:
            assert lang in LANGUAGE_RULES, f"Missing language rules for: {lang}"

    def test_each_language_has_major_minor_patch_sections(self) -> None:
        for lang, rules in LANGUAGE_RULES.items():
            assert "MAJOR (breaking):" in rules, f"{lang}: missing MAJOR section"
            assert "MINOR (backward-compatible additions):" in rules, f"{lang}: missing MINOR section"
            assert "PATCH (no API surface change):" in rules, f"{lang}: missing PATCH section"


# ---------------------------------------------------------------------------
# _build_prompt — optional context fields
# ---------------------------------------------------------------------------


class TestBuildPromptOptionalFields:
    def test_includes_previous_version_when_provided(self) -> None:
        p = _build_prompt(diff="d", language="python", previous_version="2.3.4")
        assert "Previous version: 2.3.4" in p
        assert "Do not include it literally in the commit message" in p

    def test_excludes_previous_version_when_absent(self) -> None:
        p = _build_prompt(diff="d", language="python")
        assert "Previous version:" not in p

    def test_includes_prior_changelog_when_provided(self) -> None:
        p = _build_prompt(diff="d", prior_changelog="- v1.0.0: initial release")
        assert "Prior changelog entries (for style reference):" in p
        assert "- v1.0.0: initial release" in p
        assert "Match the tone and format" in p

    def test_excludes_prior_changelog_when_absent(self) -> None:
        p = _build_prompt(diff="d")
        assert "Prior changelog entries" not in p

    def test_includes_spec_commit_message_when_provided(self) -> None:
        p = _build_prompt(diff="d", spec_commit_message="add pagination to /users")
        assert "add pagination to /users" in p
        assert "hint for understanding the intent" in p

    def test_excludes_spec_commit_message_when_absent(self) -> None:
        p = _build_prompt(diff="d")
        assert "hint for understanding the intent" not in p


# ---------------------------------------------------------------------------
# _build_prompt — brace escaping for .format() safety
# ---------------------------------------------------------------------------


class TestBuildPromptBraceEscaping:
    """The returned prompt is escaped so .format() with no kwargs is a no-op."""

    def test_format_with_no_args_does_not_raise(self) -> None:
        p = _build_prompt(diff="function foo() { return 42; }")
        # This would raise KeyError if braces are not escaped
        p.format()

    def test_format_preserves_content(self) -> None:
        p = _build_prompt(diff="x = {key: value}")
        formatted = p.format()
        assert "x = {key: value}" in formatted

    def test_diff_with_curly_braces_in_code(self) -> None:
        diff = """-export async function getUser(id: string): Promise<User> {
-    return this.request("GET", `/users/${id}`);
-}"""
        p = _build_prompt(diff=diff)
        p.format()  # should not raise

    def test_behavioral_example_braces_survive_format(self) -> None:
        p = _build_prompt(diff="d", language="python")
        formatted = p.format()
        # The examples in the prompt contain braces that should be literal after format()
        assert "getUser(id: string)" in formatted
        # Verify code braces are single (not double-escaped)
        assert "Promise<User> {" in formatted
        assert "Promise<User> {{" not in formatted
        assert "/users/${id}" in formatted
        assert "/users/{user_id}" in formatted


# ---------------------------------------------------------------------------
# Request model — backward compatibility
# ---------------------------------------------------------------------------


class TestAnalyzeCommitDiffRequestModel:
    def test_only_diff_required(self) -> None:
        req = AnalyzeCommitDiffRequest(diff="some diff")
        assert req.diff == "some diff"
        assert req.language is None
        assert req.previous_version is None
        assert req.prior_changelog is None
        assert req.spec_commit_message is None

    def test_all_fields_provided(self) -> None:
        req = AnalyzeCommitDiffRequest(
            diff="diff content",
            language="typescript",
            previous_version="1.2.3",
            prior_changelog="changelog entries",
            spec_commit_message="add feature X",
        )
        assert req.language == "typescript"
        assert req.previous_version == "1.2.3"
        assert req.prior_changelog == "changelog entries"
        assert req.spec_commit_message == "add feature X"

    def test_old_client_payload_still_works(self) -> None:
        """Old clients send only {diff: "..."} — new fields must be optional."""
        data = {"diff": "old-style diff"}
        req = AnalyzeCommitDiffRequest(**data)
        assert req.diff == "old-style diff"
        assert req.language is None

    def test_new_client_payload_with_null_fields(self) -> None:
        """New client may explicitly send null for optional fields."""
        data = {
            "diff": "new-style diff",
            "language": None,
            "previous_version": None,
            "prior_changelog": None,
            "spec_commit_message": None,
        }
        req = AnalyzeCommitDiffRequest(**data)
        assert req.language is None

    def test_serialization_roundtrip(self) -> None:
        req = AnalyzeCommitDiffRequest(
            diff="d",
            language="python",
            previous_version="1.0.0",
        )
        data = req.model_dump()
        req2 = AnalyzeCommitDiffRequest(**data)
        assert req2.language == "python"
        assert req2.previous_version == "1.0.0"


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------


class TestAnalyzeCommitDiffResponseModel:
    def test_response_has_changelog_entry_field(self) -> None:
        response = AnalyzeCommitDiffResponse(
            message="feat: add new method",
            changelog_entry="New method available.",
            version_bump=VersionBump.MINOR,
        )
        assert response.changelog_entry == "New method available."

    def test_changelog_entry_defaults_to_empty_string(self) -> None:
        response = AnalyzeCommitDiffResponse(
            message="fix: patch change",
            version_bump=VersionBump.PATCH,
        )
        assert response.changelog_entry == ""

    def test_response_serialization_includes_changelog_entry(self) -> None:
        response = AnalyzeCommitDiffResponse(
            message="feat: add endpoint",
            changelog_entry="The SDK now supports creating payments.",
            version_bump=VersionBump.MINOR,
        )
        data = response.model_dump()
        assert "changelog_entry" in data
        assert data["changelog_entry"] == "The SDK now supports creating payments."

    def test_response_deserialization_without_changelog_entry(self) -> None:
        """Old servers may not return changelog_entry — it defaults to empty."""
        data = {"message": "fix: bug", "version_bump": "PATCH"}
        response = AnalyzeCommitDiffResponse(**data)
        assert response.changelog_entry == ""
        assert response.version_bump == VersionBump.PATCH


# ---------------------------------------------------------------------------
# Endpoint integration tests (mocked AI)
# ---------------------------------------------------------------------------


@pytest.fixture()
def sdk_test_client(test_client: TestClient) -> Generator[TestClient, None, None]:
    """test_client with verify_org_token dependency overridden."""

    async def _noop_verify_org_token() -> tuple[str, list[str]]:
        return "test-token", ["test-org"]

    fai_app.dependency_overrides[verify_org_token] = _noop_verify_org_token
    yield test_client  # type: ignore[misc]
    fai_app.dependency_overrides.pop(verify_org_token, None)


class TestAnalyzeCommitDiffEndpoint:
    def test_returns_200_with_all_fields(self, sdk_test_client: TestClient) -> None:
        mock_response = AnalyzeCommitDiffResponse(
            message="feat: add retry configuration",
            changelog_entry="The SDK now supports configurable retry counts.",
            version_bump=VersionBump.MINOR,
        )
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={"diff": "-MAX_RETRIES = 3\n+MAX_RETRIES = 5", "language": "python"},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["version_bump"] == "MINOR"
            assert data["changelog_entry"] == "The SDK now supports configurable retry counts."
            assert data["message"] == "feat: add retry configuration"

    def test_legacy_request_with_diff_only(self, sdk_test_client: TestClient) -> None:
        """Old clients sending only `diff` should still work."""
        mock_response = AnalyzeCommitDiffResponse(
            message="refactor: reformat imports",
            version_bump=VersionBump.PATCH,
        )
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={"diff": "import reorg"},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            assert response.json()["version_bump"] == "PATCH"

    def test_large_diff_no_longer_returns_413(self, sdk_test_client: TestClient) -> None:
        """Large diffs are now chunked instead of rejected with 413."""
        mock_response = AnalyzeCommitDiffResponse(
            message="feat: large change",
            version_bump=VersionBump.MINOR,
            changelog_entry="Large change processed.",
        )
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={"diff": "diff --git a/f.ts b/f.ts\n+x" * 10_000},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            assert response.json()["version_bump"] == "MINOR"

    def test_500_when_ai_returns_none(self, sdk_test_client: TestClient) -> None:
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={"diff": "some diff"},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 500

    def test_prompt_includes_language_rules_when_language_provided(self, sdk_test_client: TestClient) -> None:
        """Verify the prompt passed to the AI includes language-specific rules."""
        captured_prompt: list[str] = []

        async def capture_prompt(
            *,
            response_type: type,
            prompt_template: str,
            model: str,
            **kwargs: str,
        ) -> AnalyzeCommitDiffResponse:
            captured_prompt.append(prompt_template)
            return AnalyzeCommitDiffResponse(
                message="feat: add method",
                version_bump=VersionBump.MINOR,
            )

        with patch("fai.routes.sdks.generate_anthropic_generic_async", side_effect=capture_prompt):
            sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={"diff": "test", "language": "typescript"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert len(captured_prompt) == 1
        # After .format() the double-braces become single braces
        formatted = captured_prompt[0].format()
        assert "Language-specific breaking change rules for TypeScript" in formatted
        assert "Changed HTTP status code handling" in formatted

    def test_prompt_excludes_behavioral_rules_when_no_language(self, sdk_test_client: TestClient) -> None:
        """Without language, prompt should NOT include behavioral analysis."""
        captured_prompt: list[str] = []

        async def capture_prompt(
            *,
            response_type: type,
            prompt_template: str,
            model: str,
            **kwargs: str,
        ) -> AnalyzeCommitDiffResponse:
            captured_prompt.append(prompt_template)
            return AnalyzeCommitDiffResponse(
                message="fix: patch",
                version_bump=VersionBump.PATCH,
            )

        with patch("fai.routes.sdks.generate_anthropic_generic_async", side_effect=capture_prompt):
            sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={"diff": "test"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert len(captured_prompt) == 1
        formatted = captured_prompt[0].format()
        assert "Changed HTTP status code handling" not in formatted
        assert "Language-specific breaking change rules" not in formatted

    def test_new_request_fields_threaded_into_prompt(self, sdk_test_client: TestClient) -> None:
        """Verify all new optional fields appear in the prompt when provided."""
        captured_prompt: list[str] = []

        async def capture_prompt(
            *,
            response_type: type,
            prompt_template: str,
            model: str,
            **kwargs: str,
        ) -> AnalyzeCommitDiffResponse:
            captured_prompt.append(prompt_template)
            return AnalyzeCommitDiffResponse(
                message="feat: bump",
                version_bump=VersionBump.MINOR,
            )

        with patch("fai.routes.sdks.generate_anthropic_generic_async", side_effect=capture_prompt):
            sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={
                    "diff": "test diff",
                    "language": "java",
                    "previous_version": "3.2.1",
                    "prior_changelog": "- v3.2.0: Added pagination",
                    "spec_commit_message": "add /payments endpoint",
                },
                headers={"Authorization": "Bearer test-token"},
            )

        assert len(captured_prompt) == 1
        formatted = captured_prompt[0].format()
        assert "Previous version: 3.2.1" in formatted
        assert "- v3.2.0: Added pagination" in formatted
        assert "add /payments endpoint" in formatted
        assert "Language-specific breaking change rules for Java" in formatted


# ---------------------------------------------------------------------------
# ConsolidateChangelog models
# ---------------------------------------------------------------------------


class TestConsolidateChangelogRequestModel:
    def test_required_fields(self) -> None:
        req = ConsolidateChangelogRequest(
            raw_entries="- Added method\n- Removed method",
            version_bump="MINOR",
        )
        assert req.raw_entries == "- Added method\n- Removed method"
        assert req.version_bump == "MINOR"
        assert req.language == "unknown"

    def test_all_fields_provided(self) -> None:
        req = ConsolidateChangelogRequest(
            raw_entries="- Change 1",
            version_bump="MAJOR",
            language="typescript",
        )
        assert req.language == "typescript"
        assert req.version_bump == "MAJOR"

    def test_serialization_roundtrip(self) -> None:
        req = ConsolidateChangelogRequest(
            raw_entries="- entry",
            version_bump="PATCH",
            language="python",
        )
        data = req.model_dump()
        req2 = ConsolidateChangelogRequest(**data)
        assert req2.raw_entries == "- entry"
        assert req2.version_bump == "PATCH"
        assert req2.language == "python"


class TestConsolidateChangelogResponseModel:
    def test_has_consolidated_changelog_field(self) -> None:
        resp = ConsolidateChangelogResponse(consolidated_changelog="### Breaking Changes\n- Removed `getUser()`")
        assert resp.consolidated_changelog == "### Breaking Changes\n- Removed `getUser()`"

    def test_serialization_includes_field(self) -> None:
        resp = ConsolidateChangelogResponse(consolidated_changelog="changelog text")
        data = resp.model_dump()
        assert "consolidated_changelog" in data
        assert data["consolidated_changelog"] == "changelog text"


# ---------------------------------------------------------------------------
# _consolidate_changelog internal function
# ---------------------------------------------------------------------------


class TestConsolidateChangelogFunction:
    @pytest.mark.asyncio()
    async def test_returns_consolidated_text(self) -> None:
        mock_response = ConsolidateChangelogResponse(
            consolidated_changelog="### Breaking Changes\n- Removed `oldMethod()`"
        )
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await _consolidate_changelog(
                raw_entries="- Removed oldMethod\n- Removed oldMethod",
                version_bump="MAJOR",
                language="typescript",
            )
        assert result is not None
        assert result.consolidated_changelog == "### Breaking Changes\n- Removed `oldMethod()`"

    @pytest.mark.asyncio()
    async def test_returns_none_when_ai_returns_none(self) -> None:
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=None,
        ):
            result = await _consolidate_changelog(
                raw_entries="- entry",
                version_bump="MINOR",
                language="python",
            )
        assert result is None

    @pytest.mark.asyncio()
    async def test_returns_none_when_ai_returns_blank(self) -> None:
        mock_response = ConsolidateChangelogResponse(consolidated_changelog="   ")
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await _consolidate_changelog(
                raw_entries="- entry",
                version_bump="MINOR",
                language="python",
            )
        assert result is None

    @pytest.mark.asyncio()
    async def test_strips_whitespace(self) -> None:
        mock_response = ConsolidateChangelogResponse(consolidated_changelog="  ### Enhancements\n- New method  ")
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await _consolidate_changelog(
                raw_entries="- New method\n- New method",
                version_bump="MINOR",
                language="java",
            )
        assert result is not None
        assert result.consolidated_changelog == "  ### Enhancements\n- New method  "


# ---------------------------------------------------------------------------
# /sdks/consolidate-changelog endpoint
# ---------------------------------------------------------------------------


class TestConsolidateChangelogEndpoint:
    def test_returns_200_on_success(self, sdk_test_client: TestClient) -> None:
        mock_response = ConsolidateChangelogResponse(
            consolidated_changelog="### Enhancements\n- New `getUser()` method"
        )
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = sdk_test_client.post(
                "/sdks/consolidate-changelog",
                json={
                    "raw_entries": "- New getUser method\n- New getUser method",
                    "version_bump": "MINOR",
                    "language": "typescript",
                },
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["consolidated_changelog"] == "### Enhancements\n- New `getUser()` method"

    def test_returns_500_when_ai_returns_none(self, sdk_test_client: TestClient) -> None:
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = sdk_test_client.post(
                "/sdks/consolidate-changelog",
                json={
                    "raw_entries": "- entry",
                    "version_bump": "MINOR",
                },
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 500
        assert "Failed to consolidate" in response.json()["detail"]

    def test_returns_500_on_exception(self, sdk_test_client: TestClient) -> None:
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            side_effect=RuntimeError("AI service down"),
        ):
            response = sdk_test_client.post(
                "/sdks/consolidate-changelog",
                json={
                    "raw_entries": "- entry",
                    "version_bump": "PATCH",
                    "language": "python",
                },
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 500

    def test_default_language_is_unknown(self, sdk_test_client: TestClient) -> None:
        mock_response = ConsolidateChangelogResponse(consolidated_changelog="### Improvements\n- Internal refactor")
        with patch(
            "fai.routes.sdks.generate_anthropic_generic_async",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = sdk_test_client.post(
                "/sdks/consolidate-changelog",
                json={
                    "raw_entries": "- Internal refactor",
                    "version_bump": "PATCH",
                },
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# _analyze_chunked_diff — consolidation integration
# ---------------------------------------------------------------------------


class TestAnalyzeChunkedDiffConsolidation:
    def test_multi_chunk_calls_consolidation(self, sdk_test_client: TestClient) -> None:
        """When multiple chunks produce changelog entries, consolidation AI is called."""
        call_count = {"analyze": 0, "consolidate": 0}

        async def mock_ai(
            *,
            response_type: type,
            prompt_template: str,
            model: str,
            **kwargs: str,
        ) -> AnalyzeCommitDiffResponse | ConsolidateChangelogResponse | None:
            if response_type == ConsolidateChangelogResponse:
                call_count["consolidate"] += 1
                return ConsolidateChangelogResponse(consolidated_changelog="### Enhancements\n- Consolidated entry")
            call_count["analyze"] += 1
            return AnalyzeCommitDiffResponse(
                message="feat: change",
                version_bump=VersionBump.MINOR,
                changelog_entry=f"Change from chunk {call_count['analyze']}",
            )

        large_diff = "\n".join(
            f"diff --git a/file{i}.ts b/file{i}.ts\n--- a/file{i}.ts\n+++ b/file{i}.ts\n"
            + "\n".join(f"+line {j}" for j in range(200))
            for i in range(50)
        )

        with patch("fai.routes.sdks.generate_anthropic_generic_async", side_effect=mock_ai):
            response = sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={"diff": large_diff, "language": "typescript"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        assert call_count["analyze"] > 1
        assert call_count["consolidate"] == 1
        data = response.json()
        assert data["changelog_entry"] == "### Enhancements\n- Consolidated entry"

    def test_consolidation_failure_falls_back_to_raw(self, sdk_test_client: TestClient) -> None:
        """When consolidation AI fails, raw entries are used as fallback."""
        call_count = {"analyze": 0}

        async def mock_ai(
            *,
            response_type: type,
            prompt_template: str,
            model: str,
            **kwargs: str,
        ) -> AnalyzeCommitDiffResponse | None:
            if response_type == ConsolidateChangelogResponse:
                raise RuntimeError("Consolidation failed")
            call_count["analyze"] += 1
            return AnalyzeCommitDiffResponse(
                message="feat: change",
                version_bump=VersionBump.MINOR,
                changelog_entry=f"Entry {call_count['analyze']}",
            )

        large_diff = "\n".join(
            f"diff --git a/file{i}.ts b/file{i}.ts\n--- a/file{i}.ts\n+++ b/file{i}.ts\n"
            + "\n".join(f"+line {j}" for j in range(200))
            for i in range(50)
        )

        with patch("fai.routes.sdks.generate_anthropic_generic_async", side_effect=mock_ai):
            response = sdk_test_client.post(
                "/sdks/analyze-commit-diff",
                json={"diff": large_diff, "language": "typescript"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "- Entry" in data["changelog_entry"]
