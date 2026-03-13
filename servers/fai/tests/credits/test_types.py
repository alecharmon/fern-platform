from fai.credits.types import CreditCheckResult


def test_credit_check_result_allowed() -> None:
    result = CreditCheckResult(allowed=True, used=50, limit=1000)
    assert result.allowed is True
    assert result.used == 50
    assert result.limit == 1000


def test_credit_check_result_denied() -> None:
    result = CreditCheckResult(allowed=False, used=1000, limit=1000)
    assert result.allowed is False


def test_credit_check_result_from_dict() -> None:
    data = {"allowed": True, "used": 100, "limit": 250}
    result = CreditCheckResult(**data)
    assert result.allowed is True
    assert result.used == 100
    assert result.limit == 250
