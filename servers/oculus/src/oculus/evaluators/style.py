import re
from typing import Any

from oculus.framework.evaluators import (
    ScaledEvaluationResult,
    register_evaluator,
)


def check_no_repetitive_phrases(answer: str, threshold: int = 3) -> tuple[bool, dict[str, int]]:
    """Check for excessively repeated phrases.

    Returns:
        Tuple of (passes, phrase_counts)
    """
    repetitive_patterns = [
        r"let me search",
        r"based on the documentation",
        r"according to the docs",
        r"the documentation shows",
        r"the documentation states",
    ]

    phrase_counts = {}
    for pattern in repetitive_patterns:
        count = len(re.findall(pattern, answer, re.IGNORECASE))
        if count > 0:
            phrase_counts[pattern] = count

    max_count = max(phrase_counts.values()) if phrase_counts else 0
    passes = max_count < threshold

    return passes, phrase_counts


def check_no_first_person(answer: str) -> tuple[bool, int]:
    """Check for first-person pronouns.

    Returns:
        Tuple of (passes, count)
    """
    first_person_pattern = r'\b(I|I\'m|I\'ll|I\'ve|I\'d|my|me|myself)\b'

    code_blocks = []

    for match in re.finditer(r'`[^`]+`', answer):
        code_blocks.append((match.start(), match.end()))

    for match in re.finditer(r'```[\s\S]*?```', answer):
        code_blocks.append((match.start(), match.end()))

    def is_in_code_block(pos: int) -> bool:
        """Check if a position is inside a code block."""
        for start, end in code_blocks:
            if start <= pos < end:
                return True
        return False

    count = 0
    for match in re.finditer(first_person_pattern, answer, re.IGNORECASE):
        if not is_in_code_block(match.start()):
            count += 1

    passes = count == 0

    return passes, count


def check_no_apologies(answer: str) -> tuple[bool, int]:
    """Check for apologetic language.

    Returns:
        Tuple of (passes, count)
    """
    apology_patterns = [
        r'\bsorry\b',
        r'\bapologi[zs]e\b',
        r'\bapologi[zs]ed\b',
        r'\bapologies\b',
        r'\bapologetic\b',
    ]

    count = 0
    for pattern in apology_patterns:
        count += len(re.findall(pattern, answer, re.IGNORECASE))

    passes = count == 0

    return passes, count


def check_no_meta_commentary(answer: str, threshold: int = 2) -> tuple[bool, int]:
    """Check for meta-commentary about what the assistant is doing.

    Returns:
        Tuple of (passes, count)
    """
    meta_patterns = [
        r"(?:let me|i'll|i will|i'm going to) (?:search|look|check|find|explore|investigate|examine)",
        r"(?:i'm|i am) (?:searching|looking|checking|finding|exploring|investigating|examining)",
        r"let me (?:help|assist|explain|show|tell) you",
    ]

    count = 0
    for pattern in meta_patterns:
        count += len(re.findall(pattern, answer, re.IGNORECASE))

    passes = count < threshold

    return passes, count


def check_no_heading1(answer: str) -> tuple[bool, int]:
    """Check for markdown heading 1 usage.

    Returns:
        Tuple of (passes, count)
    """
    heading1_pattern = r'^# [^#].*$'
    matches = re.findall(heading1_pattern, answer, re.MULTILINE)

    count = len(matches)
    passes = count == 0

    return passes, count


def check_no_based_on_docs(answer: str, threshold: int = 2) -> tuple[bool, int]:
    """Check for excessive use of 'based on the documentation' phrases.

    Returns:
        Tuple of (passes, count)
    """
    pattern = r'based on (?:the )?(?:documentation|docs|provided information)'
    count = len(re.findall(pattern, answer, re.IGNORECASE))

    passes = count < threshold

    return passes, count


@register_evaluator("style")
def evaluate_style(
    answer: str,
    **kwargs: Any,
) -> ScaledEvaluationResult | None:
    """Evaluate answer against style guidelines.

    Checks multiple style rules and returns a score (x/y rules passed).
    Each rule is tracked individually in metadata as pass/fail.

    Args:
        answer: The answer to evaluate
        **kwargs: Additional configuration (repetitive_threshold, meta_threshold, passing_threshold, etc.)

    Returns:
        ScaledEvaluationResult with score = rules passed, detailed rule breakdown in metadata
    """
    if not answer:
        return None

    repetitive_threshold = kwargs.get("repetitive_threshold", 3)
    meta_threshold = kwargs.get("meta_threshold", 2)
    based_on_docs_threshold = kwargs.get("based_on_docs_threshold", 2)
    passing_threshold = kwargs.get("passing_threshold", 6)  # Default: all rules must pass

    no_repetitive, repetitive_phrases = check_no_repetitive_phrases(answer, repetitive_threshold)
    no_first_person, first_person_count = check_no_first_person(answer)
    no_apologies, apology_count = check_no_apologies(answer)
    no_meta, meta_count = check_no_meta_commentary(answer, meta_threshold)
    no_heading1, heading1_count = check_no_heading1(answer)
    no_based_on_docs, based_on_docs_count = check_no_based_on_docs(answer, based_on_docs_threshold)

    rules = {
        "no_repetitive_phrases": no_repetitive,
        "no_first_person": no_first_person,
        "no_apologies": no_apologies,
        "no_meta_commentary": no_meta,
        "no_heading1": no_heading1,
        "no_based_on_docs": no_based_on_docs,
    }

    counts = {
        "first_person_count": first_person_count,
        "apology_count": apology_count,
        "meta_commentary_count": meta_count,
        "heading1_count": heading1_count,
        "based_on_docs_count": based_on_docs_count,
        "repetitive_phrases": str(repetitive_phrases) if repetitive_phrases else "none",
    }

    total_rules = len(rules)
    rules_passed = sum(1 for passed in rules.values() if passed)

    if rules_passed == total_rules:
        reason = f"Passed all {total_rules}/{total_rules} style rules"
    else:
        failed_rules = [rule for rule, passed in rules.items() if not passed]
        reason = f"Passed {rules_passed}/{total_rules} style rules. Failed: {', '.join(failed_rules)}"

    metadata = {
        "evaluator": "style",
        "rules_passed": str(rules_passed),
        "total_rules": str(total_rules),
        **{f"rule_{k}": "pass" if v else "fail" for k, v in rules.items()},
        **{f"count_{k}": str(v) for k, v in counts.items()},
    }

    return ScaledEvaluationResult(
        score=rules_passed,
        min_score=0,
        max_score=total_rules,
        passing_threshold=passing_threshold,
        reason=reason,
        metadata=metadata,
    )
