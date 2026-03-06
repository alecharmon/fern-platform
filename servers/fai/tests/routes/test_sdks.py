from fai.models.api.sdks_api import AnalyzeCommitDiffResponse, VersionBump
from fai.routes.sdks import COMMIT_ANALYSIS_PROMPT


class TestCommitAnalysisPromptExamples:
    def test_prompt_includes_major_example_for_removed_export(self) -> None:
        assert "MAJOR: removed exported TypeScript function" in COMMIT_ANALYSIS_PROMPT
        assert "Existing callers of getUser() will get a compile error" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_includes_major_example_for_removed_method(self) -> None:
        assert "MAJOR: removed Python public method" in COMMIT_ANALYSIS_PROMPT
        assert "Existing callers crash with AttributeError" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_includes_minor_example_for_optional_parameter(self) -> None:
        assert "MINOR: new optional TypeScript parameter" in COMMIT_ANALYSIS_PROMPT
        assert "new parameter is optional" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_includes_minor_example_for_new_method(self) -> None:
        assert "MINOR: new Java public method" in COMMIT_ANALYSIS_PROMPT
        assert "New capability added, nothing removed or changed" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_includes_patch_example_for_internal_constant(self) -> None:
        assert "PATCH: internal retry constant" in COMMIT_ANALYSIS_PROMPT
        assert "public API surface unchanged" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_includes_patch_example_for_import_reorganization(self) -> None:
        assert "PATCH: Go import reorganization" in COMMIT_ANALYSIS_PROMPT
        assert "Formatting change only, no functional difference" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_covers_typescript_language(self) -> None:
        assert "client.ts" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_covers_python_language(self) -> None:
        assert "client.py" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_covers_java_language(self) -> None:
        assert "UsersClient.java" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_covers_go_language(self) -> None:
        assert "client.go" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_includes_when_in_doubt_guidance(self) -> None:
        assert "When in doubt between MINOR and PATCH" in COMMIT_ANALYSIS_PROMPT
        assert "When in doubt between MAJOR and MINOR" in COMMIT_ANALYSIS_PROMPT

    def test_examples_placed_before_message_format(self) -> None:
        examples_pos = COMMIT_ANALYSIS_PROMPT.index("--- Examples ---")
        end_examples_pos = COMMIT_ANALYSIS_PROMPT.index("--- End Examples ---")
        message_format_pos = COMMIT_ANALYSIS_PROMPT.index("Message Format")
        assert examples_pos < end_examples_pos < message_format_pos


class TestCommitAnalysisPromptChangelogEntry:
    def test_prompt_mentions_changelog_entry_field(self) -> None:
        assert "changelog_entry" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_includes_changelog_guidelines_section(self) -> None:
        assert "Changelog Entry Guidelines:" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_changelog_patch_returns_empty(self) -> None:
        assert "PATCH: return an empty string" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_changelog_no_change_returns_empty(self) -> None:
        assert "NO_CHANGE: return an empty string" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_changelog_no_conventional_commits(self) -> None:
        assert "Do not use conventional commit prefixes" in COMMIT_ANALYSIS_PROMPT

    def test_prompt_changelog_third_person(self) -> None:
        assert "Write in third person" in COMMIT_ANALYSIS_PROMPT

    def test_changelog_guidelines_placed_after_message_guidelines(self) -> None:
        message_pos = COMMIT_ANALYSIS_PROMPT.index("Message Guidelines:")
        changelog_pos = COMMIT_ANALYSIS_PROMPT.index("Changelog Entry Guidelines:")
        assert message_pos < changelog_pos


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
        data = {"message": "fix: bug", "version_bump": "PATCH"}
        response = AnalyzeCommitDiffResponse(**data)
        assert response.changelog_entry == ""
        assert response.version_bump == VersionBump.PATCH
