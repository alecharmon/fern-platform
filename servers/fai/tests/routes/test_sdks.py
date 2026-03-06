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
