from oculus.evaluators.style import check_no_apologies


class TestCheckNoApologies:
    """Tests for apologetic language detection."""

    def test_no_apologies(self):
        answer = "The API endpoint is /users. It returns user data."
        passes, count = check_no_apologies(answer)
        assert passes is True
        assert count == 0

    def test_sorry(self):
        answer = "Sorry, I made an error. The correct endpoint is /users."
        passes, count = check_no_apologies(answer)
        assert passes is False
        assert count == 1

    def test_apologize(self):
        answer = "I apologize for the confusion."
        passes, count = check_no_apologies(answer)
        assert passes is False
        assert count == 1

    def test_apologies(self):
        answer = "My apologies, here's the correct information."
        passes, count = check_no_apologies(answer)
        assert passes is False
        assert count == 1

    def test_multiple_forms(self):
        answer = "Sorry, I apologize. My apologies for the error."
        passes, count = check_no_apologies(answer)
        assert passes is False
        assert count == 3

    def test_case_insensitive(self):
        answer = "SORRY for the confusion. I APOLOGIZE."
        passes, count = check_no_apologies(answer)
        assert passes is False
        assert count == 2

    def test_apologised_uk_spelling(self):
        answer = "I apologised for the error."
        passes, count = check_no_apologies(answer)
        assert passes is False
        assert count == 1
