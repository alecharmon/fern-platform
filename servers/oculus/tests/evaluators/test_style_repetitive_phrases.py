from oculus.evaluators.style import check_no_repetitive_phrases


class TestCheckNoRepetitivePhrases:
    """Tests for repetitive phrase detection."""

    def test_no_repetition(self):
        answer = "The API endpoint is /users. You can use GET to retrieve data."
        passes, phrases = check_no_repetitive_phrases(answer)
        assert passes is True
        assert phrases == {}

    def test_single_occurrence_below_threshold(self):
        answer = "Let me search for this information in the docs."
        passes, phrases = check_no_repetitive_phrases(answer, threshold=3)
        assert passes is True
        assert phrases == {"let me search": 1}

    def test_at_threshold(self):
        answer = "Let me search. Let me search again."
        passes, phrases = check_no_repetitive_phrases(answer, threshold=3)
        assert passes is True
        assert phrases["let me search"] == 2

    def test_exceeds_threshold(self):
        answer = "Let me search. Let me search. Let me search. Let me search."
        passes, phrases = check_no_repetitive_phrases(answer, threshold=3)
        assert passes is False
        assert phrases["let me search"] == 4

    def test_multiple_patterns(self):
        answer = "Based on the documentation, let me search. Based on the documentation again."
        passes, phrases = check_no_repetitive_phrases(answer, threshold=2)
        assert passes is False
        assert "based on the documentation" in phrases
        assert phrases["based on the documentation"] == 2

    def test_case_insensitive(self):
        answer = "Let me search. LET ME SEARCH. Let Me Search."
        passes, phrases = check_no_repetitive_phrases(answer, threshold=4)
        assert passes is True
        assert phrases["let me search"] == 3
