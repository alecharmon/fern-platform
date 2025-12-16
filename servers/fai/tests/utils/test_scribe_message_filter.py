from fai.utils.scribe.session_poller import should_filter_message


class TestMessageFiltering:
    def test_filters_clone_warning(self) -> None:
        message = (
            "Warning: your clone commands for fern-api/docs failed to run and returned with a return code of 1. "
            "This could cause Devin to develop on outdated code."
        )
        assert should_filter_message(message) is True

    def test_filters_partial_clone_warning(self) -> None:
        message = "Warning: your clone commands for some-repo failed to run and returned with a return code of 128"
        assert should_filter_message(message) is True

    def test_filters_outdated_code_warning(self) -> None:
        message = "This could cause Devin to develop on outdated code"
        assert should_filter_message(message) is True

    def test_does_not_filter_normal_messages(self) -> None:
        message = "I've successfully cloned the repository and started working on the feature"
        assert should_filter_message(message) is False

    def test_does_not_filter_other_warnings(self) -> None:
        message = "Warning: this might take a while to complete"
        assert should_filter_message(message) is False

    def test_case_insensitive_filtering(self) -> None:
        message = "WARNING: YOUR CLONE COMMANDS FOR repo FAILED TO RUN AND RETURNED WITH A RETURN CODE"
        assert should_filter_message(message) is True

    def test_filters_with_extra_text(self) -> None:
        message = (
            "I'm working on your request. "
            "Warning: your clone commands for fern-api/docs failed to run and returned with a return code of 1. "
            "However, I'll proceed with the available code."
        )
        assert should_filter_message(message) is True

    def test_empty_message(self) -> None:
        assert should_filter_message("") is False

    def test_none_pattern_match(self) -> None:
        message = "Just a regular status update about the work"
        assert should_filter_message(message) is False
