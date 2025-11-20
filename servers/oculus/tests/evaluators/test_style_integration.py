from oculus.evaluators.style import evaluate_style


class TestEvaluateStyle:
    """Integration tests for the complete style evaluator."""

    def test_perfect_answer(self):
        answer = "The API endpoint is /users/{id}. You can retrieve user details by sending a GET request."
        result = evaluate_style(answer=answer)

        assert result is not None
        assert result.score == 6
        assert result.max_score == 6
        assert result.is_passing() is True
        assert "6/6" in result.reason
        assert result.metadata["rule_no_first_person"] == "pass"
        assert result.metadata["rule_no_apologies"] == "pass"

    def test_single_violation(self):
        answer = "Sorry, the API endpoint is /users/{id}."
        result = evaluate_style(answer=answer)

        assert result is not None
        assert result.score == 5
        assert result.max_score == 6
        assert result.is_passing() is False
        assert "5/6" in result.reason
        assert result.metadata["rule_no_apologies"] == "fail"
        assert result.metadata["rule_no_first_person"] == "pass"

    def test_multiple_violations(self):
        answer = "# Title\n\nSorry, let me search for this. I'm going to look."
        result = evaluate_style(answer=answer)

        assert result is not None
        assert result.score < 6
        assert result.is_passing() is False
        assert result.metadata["rule_no_apologies"] == "fail"
        assert result.metadata["rule_no_heading1"] == "fail"
        assert result.metadata["rule_no_first_person"] == "fail"

    def test_all_violations(self):
        answer = """# Title

Sorry, let me search for this. I'm going to look. Based on the documentation,
based on the docs, based on the provided information. Let me search. Let me search.
Let me search. Let me search."""
        result = evaluate_style(answer=answer)

        assert result is not None
        assert result.score == 0
        assert result.max_score == 6
        assert result.is_passing() is False
        assert "0/6" in result.reason

    def test_empty_answer(self):
        result = evaluate_style(answer="")
        assert result is None

    def test_none_answer(self):
        result = evaluate_style(answer=None)
        assert result is None

    def test_custom_thresholds(self):
        answer = "Let me search. Let me search."
        result = evaluate_style(
            answer=answer,
            meta_threshold=3,  # Allow up to 3 meta-commentary instances
        )

        assert result is not None
        # Should pass meta_commentary check with higher threshold
        # But might fail first_person check
        assert result.metadata["count_meta_commentary_count"] == "2"

    def test_custom_passing_threshold(self):
        answer = "Sorry, the API endpoint is /users/{id}."
        result = evaluate_style(
            answer=answer,
            passing_threshold=5,  # Pass if 5+ rules pass
        )

        assert result is not None
        assert result.score == 5
        assert result.passing_threshold == 5
        assert result.is_passing() is True  # 5 >= 5

    def test_metadata_contains_counts(self):
        answer = "I think I'm going to use this. Sorry, my apologies."
        result = evaluate_style(answer=answer)

        assert result is not None
        assert "count_first_person_count" in result.metadata
        assert "count_apology_count" in result.metadata
        assert int(result.metadata["count_first_person_count"]) > 0
        assert int(result.metadata["count_apology_count"]) > 0

    def test_code_blocks_ignored_in_first_person(self):
        answer = """The variable `myVar` stores data. Here's code:
```python
my_list = [1, 2, 3]
I = 10
```
This approach works well."""
        result = evaluate_style(answer=answer)

        assert result is not None
        assert result.metadata["rule_no_first_person"] == "pass"
        assert result.metadata["count_first_person_count"] == "0"

    def test_edge_case_only_headings(self):
        answer = "# Title\n## Subtitle\n### Section"
        result = evaluate_style(answer=answer)

        assert result is not None
        assert result.metadata["rule_no_heading1"] == "fail"
        assert result.metadata["count_heading1_count"] == "1"

    def test_reason_lists_failed_rules(self):
        answer = "# Title\n\nSorry for the confusion."
        result = evaluate_style(answer=answer)

        assert result is not None
        assert "no_apologies" in result.reason
        assert "no_heading1" in result.reason
        assert "4/6" in result.reason
