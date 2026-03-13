from dataclasses import dataclass


@dataclass
class CreditCheckResult:
    allowed: bool
    used: int
    limit: int
