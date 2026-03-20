"""Tests that validate diff_chunking against shared cross-implementation fixtures.

The JSON fixture files live in ``fai/data/test_fixtures/`` and are the
single source of truth for expected behaviour.  The same fixtures should
be consumed by the TypeScript (fern CLI) and Java (Fiddle) implementations
so that all three stay in sync.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from fai.utils.diff_chunking import (
    FileSection,
    chunk_diff,
    classify_section,
    max_version_bump,
)

_FIXTURES_DIR = (
    Path(__file__).resolve().parent.parent.parent
    / "src"
    / "fai"
    / "data"
    / "test_fixtures"
)


def _load_fixture(name: str) -> dict[str, Any]:
    with open(_FIXTURES_DIR / name) as f:
        return json.load(f)


# ── section_classification ──────────────────────────────────────────────


_classification_data = _load_fixture("section_classification.json")


@pytest.mark.parametrize(
    "case",
    _classification_data["cases"],
    ids=[c["name"] for c in _classification_data["cases"]],
)
def test_classify_section_fixture(case: dict[str, Any]) -> None:
    section = FileSection(lines=case["lines"])
    assert classify_section(section) == case["expected_priority"], (
        f"Section '{case['name']}' expected priority {case['expected_priority']}"
    )


# ── chunk_diff ──────────────────────────────────────────────────────────


_chunk_data = _load_fixture("chunk_diff.json")


@pytest.mark.parametrize(
    "case",
    _chunk_data["cases"],
    ids=[c["name"] for c in _chunk_data["cases"]],
)
def test_chunk_diff_fixture(case: dict[str, Any]) -> None:
    chunks = chunk_diff(case["diff"], case["max_bytes_per_chunk"])

    if "expected_chunk_count" in case:
        assert len(chunks) == case["expected_chunk_count"], (
            f"'{case['name']}': expected {case['expected_chunk_count']} chunks, got {len(chunks)}"
        )

    if "expected_min_chunks" in case:
        assert len(chunks) >= case["expected_min_chunks"], (
            f"'{case['name']}': expected >= {case['expected_min_chunks']} chunks, got {len(chunks)}"
        )

    if "first_chunk_contains" in case:
        assert case["first_chunk_contains"] in chunks[0], (
            f"'{case['name']}': first chunk missing '{case['first_chunk_contains']}'"
        )

    if "all_chunks_start_with" in case:
        prefix = case["all_chunks_start_with"]
        for i, chunk in enumerate(chunks):
            assert chunk.startswith(prefix), (
                f"'{case['name']}': chunk {i} does not start with '{prefix}'"
            )


# ── max_version_bump ────────────────────────────────────────────────────


_bump_data = _load_fixture("max_version_bump.json")


@pytest.mark.parametrize(
    "case",
    _bump_data["cases"],
    ids=[f"{c['first']}_vs_{c['second']}" for c in _bump_data["cases"]],
)
def test_max_version_bump_fixture(case: dict[str, Any]) -> None:
    assert max_version_bump(case["first"], case["second"]) == case["expected"]
