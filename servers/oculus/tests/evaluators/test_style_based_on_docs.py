from oculus.evaluators.style import check_no_based_on_docs


class TestCheckNoBasedOnDocs:
    """Tests for 'based on documentation' phrase detection."""

    def test_no_based_on_docs(self):
        answer = "The API endpoint is /users. It returns user data."
        passes, count = check_no_based_on_docs(answer)
        assert passes is True
        assert count == 0

    def test_single_occurrence(self):
        answer = "Based on the documentation, the endpoint is /users."
        passes, count = check_no_based_on_docs(answer, threshold=2)
        assert passes is True
        assert count == 1

    def test_at_threshold(self):
        answer = "Based on the documentation, this works."
        passes, count = check_no_based_on_docs(answer, threshold=2)
        assert passes is True
        assert count == 1

    def test_exceeds_threshold(self):
        answer = "Based on the documentation, X. Based on the docs, Y. Based on provided information, Z."
        passes, count = check_no_based_on_docs(answer, threshold=2)
        assert passes is False
        assert count == 3

    def test_variations(self):
        answer = "Based on documentation and based on docs and based on the provided information."
        passes, count = check_no_based_on_docs(answer, threshold=2)
        assert passes is False
        assert count == 3

    def test_case_insensitive(self):
        answer = "BASED ON THE DOCUMENTATION, this works. Based On The Docs, it's fine."
        passes, count = check_no_based_on_docs(answer, threshold=3)
        assert passes is True
        assert count == 2
