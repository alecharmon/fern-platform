from oculus.evaluators.style import check_no_heading1


class TestCheckNoHeading1:
    """Tests for heading 1 detection."""

    def test_no_headings(self):
        answer = "The API endpoint is /users. It returns user data."
        passes, count = check_no_heading1(answer)
        assert passes is True
        assert count == 0

    def test_heading2_allowed(self):
        answer = "## Subsection\n\nContent here."
        passes, count = check_no_heading1(answer)
        assert passes is True
        assert count == 0

    def test_heading3_allowed(self):
        answer = "### Subsubsection\n\nContent here."
        passes, count = check_no_heading1(answer)
        assert passes is True
        assert count == 0

    def test_single_heading1(self):
        answer = "# Main Title\n\nContent here."
        passes, count = check_no_heading1(answer)
        assert passes is False
        assert count == 1

    def test_multiple_heading1(self):
        answer = "# Title 1\n\nContent.\n\n# Title 2\n\nMore content."
        passes, count = check_no_heading1(answer)
        assert passes is False
        assert count == 2

    def test_mixed_headings(self):
        answer = "# Main Title\n\n## Subsection\n\n### Details"
        passes, count = check_no_heading1(answer)
        assert passes is False
        assert count == 1

    def test_hash_in_middle_of_line(self):
        answer = "Use #hashtag or reference issue #123."
        passes, count = check_no_heading1(answer)
        assert passes is True
        assert count == 0

    def test_hash_without_space(self):
        answer = "#NoSpace\n\nThis shouldn't be detected as heading."
        passes, count = check_no_heading1(answer)
        assert passes is True
        assert count == 0
