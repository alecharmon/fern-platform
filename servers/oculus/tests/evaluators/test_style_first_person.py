from oculus.evaluators.style import check_no_first_person


class TestCheckNoFirstPerson:
    """Tests for first-person pronoun detection."""

    def test_no_first_person(self):
        answer = "The API endpoint allows you to retrieve user data."
        passes, count = check_no_first_person(answer)
        assert passes is True
        assert count == 0

    def test_single_i(self):
        answer = "I recommend using the GET endpoint."
        passes, count = check_no_first_person(answer)
        assert passes is False
        assert count == 1

    def test_contractions(self):
        answer = "I'm going to show you. I'll demonstrate. I've tested this."
        passes, count = check_no_first_person(answer)
        assert passes is False
        assert count == 3

    def test_possessive_my(self):
        answer = "In my experience, this works well. My recommendation is to use POST."
        passes, count = check_no_first_person(answer)
        assert passes is False
        assert count == 2

    def test_me_myself(self):
        answer = "Let me help you. I did it myself."
        passes, count = check_no_first_person(answer)
        assert passes is False
        assert count == 3  # "me", "I", "myself"

    def test_in_inline_code_block(self):
        answer = "Use the variable `myVariable` to store data."
        passes, count = check_no_first_person(answer)
        assert passes is True
        assert count == 0

    def test_in_fenced_code_block(self):
        answer = """Here's an example:
```python
my_var = 5
I = 10
```
This code works."""
        passes, count = check_no_first_person(answer)
        assert passes is True
        assert count == 0

    def test_outside_code_block(self):
        answer = "The endpoint is `/users/{id}`. I recommend using this approach."
        passes, count = check_no_first_person(answer)
        assert passes is False
        assert count == 1

    def test_mixed_code_and_text(self):
        answer = "I think `myVariable` works. My code uses `I` as a variable."
        passes, count = check_no_first_person(answer)
        assert passes is False
        assert count == 2  # "I" and "My" outside code

    def test_case_insensitive(self):
        answer = "i recommend this approach."
        passes, count = check_no_first_person(answer)
        assert passes is False
        assert count == 1
