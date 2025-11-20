from oculus.evaluators.style import check_no_meta_commentary


class TestCheckNoMetaCommentary:
    """Tests for meta-commentary detection."""

    def test_no_meta_commentary(self):
        answer = "The API endpoint is /users. It returns user data."
        passes, count = check_no_meta_commentary(answer)
        assert passes is True
        assert count == 0

    def test_let_me_search(self):
        answer = "Let me search for that information."
        passes, count = check_no_meta_commentary(answer, threshold=2)
        assert passes is True
        assert count == 1

    def test_multiple_let_me(self):
        answer = "Let me search. Let me look. Let me check."
        passes, count = check_no_meta_commentary(answer, threshold=2)
        assert passes is False
        assert count == 3

    def test_im_going_to(self):
        answer = "I'm going to search for this. I'm going to look it up."
        passes, count = check_no_meta_commentary(answer, threshold=2)
        assert passes is False
        assert count == 2

    def test_let_me_help(self):
        answer = "Let me help you with this. Let me assist you."
        passes, count = check_no_meta_commentary(answer, threshold=2)
        assert passes is False
        assert count == 2

    def test_case_insensitive(self):
        answer = "LET ME SEARCH for this. I'M GOING TO LOOK it up."
        passes, count = check_no_meta_commentary(answer, threshold=2)
        assert passes is False
        assert count == 2

    def test_below_threshold(self):
        answer = "Let me search for this."
        passes, count = check_no_meta_commentary(answer, threshold=2)
        assert passes is True
        assert count == 1
