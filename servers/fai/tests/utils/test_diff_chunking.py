"""Tests for diff_chunking utilities — unit tests and large-diff e2e tests."""

import pytest

from fai.utils.diff_chunking import (
    MAX_AI_DIFF_BYTES,
    MAX_CHUNKS,
    FileSection,
    chunk_diff,
    classify_section,
    max_version_bump,
    parse_file_sections,
)

# ── classify_section ─────────────────────────────────────────────────────


class TestClassifySection:
    def test_deletion_only_returns_priority_1(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/src/client.ts b/src/client.ts",
                "--- a/src/client.ts",
                "+++ b/src/client.ts",
                "-export function getUser(id: string): User {",
                "-  return this.fetch(id);",
                "-}",
            ]
        )
        assert classify_section(section) == 1

    def test_mixed_with_signature_returns_priority_2(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/src/client.ts b/src/client.ts",
                "-export function getUser(id: string): User {",
                "+export function getUser(id: string, opts?: Options): User {",
            ]
        )
        assert classify_section(section) == 2

    def test_mixed_no_signature_returns_priority_3(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/src/internal.ts b/src/internal.ts",
                "-const timeout = 3000;",
                "+const timeout = 5000;",
            ]
        )
        assert classify_section(section) == 3

    def test_addition_only_returns_priority_4(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/src/new_client.ts b/src/new_client.ts",
                "+++ b/src/new_client.ts",
                "+export class NewClient {",
                "+  constructor() {}",
                "+}",
            ]
        )
        assert classify_section(section) == 4

    def test_context_only_returns_priority_5(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/src/client.ts b/src/client.ts",
                " // Some unchanged context line",
                " const x = 1;",
            ]
        )
        assert classify_section(section) == 5

    # Cross-language signature detection
    def test_java_public_method_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/Client.java b/Client.java",
                "-public CompletableFuture<User> getUser(String id) {",
                "+public CompletableFuture<User> getUser(String id, Options opts) {",
            ]
        )
        assert classify_section(section) == 2

    def test_python_def_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/client.py b/client.py",
                "-def get_user(self, user_id: str) -> User:",
                "+def get_user(self, user_id: str, timeout: int = 30) -> User:",
            ]
        )
        assert classify_section(section) == 2

    def test_go_exported_func_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/client.go b/client.go",
                "-func GetUser(id string) (*User, error) {",
                "+func GetUser(id string, opts ...Option) (*User, error) {",
            ]
        )
        assert classify_section(section) == 2

    def test_go_method_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/client.go b/client.go",
                "-func (c *Client) GetUser(id string) (*User, error) {",
                "+func (c *Client) GetUser(id string, opts ...Option) (*User, error) {",
            ]
        )
        assert classify_section(section) == 2

    def test_rust_pub_fn_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/src/lib.rs b/src/lib.rs",
                "-pub fn get_user(id: &str) -> Result<User, Error> {",
                "+pub fn get_user(id: &str, opts: Options) -> Result<User, Error> {",
            ]
        )
        assert classify_section(section) == 2

    def test_ruby_def_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/lib/client.rb b/lib/client.rb",
                "-def get_user(user_id)",
                "+def get_user(user_id, opts = {})",
            ]
        )
        assert classify_section(section) == 2

    def test_csharp_public_method_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/Client.cs b/Client.cs",
                "-public async Task<User> GetUserAsync(string id) {",
                "+public async Task<User> GetUserAsync(string id, CancellationToken ct) {",
            ]
        )
        assert classify_section(section) == 2

    def test_php_function_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/src/Client.php b/src/Client.php",
                "-function getUser(string $id): User {",
                "+function getUser(string $id, array $opts = []): User {",
            ]
        )
        assert classify_section(section) == 2

    def test_swift_open_class_signature(self) -> None:
        section = FileSection(
            lines=[
                "diff --git a/Sources/Client.swift b/Sources/Client.swift",
                "-open class UserClient {",
                "+open class UserClient: Sendable {",
            ]
        )
        assert classify_section(section) == 2

    def test_diff_header_lines_not_treated_as_changes(self) -> None:
        """Lines starting with --- or +++ are diff headers, not changes."""
        section = FileSection(
            lines=[
                "diff --git a/file.ts b/file.ts",
                "--- a/file.ts",
                "+++ b/file.ts",
            ]
        )
        assert classify_section(section) == 5


# ── parse_file_sections ──────────────────────────────────────────────────


class TestParseFileSections:
    def test_single_file(self) -> None:
        lines = [
            "diff --git a/file.ts b/file.ts",
            "--- a/file.ts",
            "+++ b/file.ts",
            "-old line",
            "+new line",
        ]
        sections = parse_file_sections(lines)
        assert len(sections) == 1
        assert sections[0].lines == lines

    def test_multiple_files(self) -> None:
        lines = [
            "diff --git a/a.ts b/a.ts",
            "-removed",
            "diff --git a/b.ts b/b.ts",
            "+added",
            "diff --git a/c.ts b/c.ts",
            " context",
        ]
        sections = parse_file_sections(lines)
        assert len(sections) == 3
        assert sections[0].lines == ["diff --git a/a.ts b/a.ts", "-removed"]
        assert sections[1].lines == ["diff --git a/b.ts b/b.ts", "+added"]
        assert sections[2].lines == ["diff --git a/c.ts b/c.ts", " context"]

    def test_empty_diff(self) -> None:
        sections = parse_file_sections([])
        assert len(sections) == 0

    def test_no_diff_header(self) -> None:
        lines = ["just some text", "no diff headers"]
        sections = parse_file_sections(lines)
        assert len(sections) == 1


# ── chunk_diff ───────────────────────────────────────────────────────────


class TestChunkDiff:
    def test_small_diff_single_chunk(self) -> None:
        diff = "diff --git a/file.ts b/file.ts\n-old\n+new"
        chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)
        assert len(chunks) == 1
        assert chunks[0] == diff

    def test_empty_diff_returns_single_chunk(self) -> None:
        chunks = chunk_diff("", MAX_AI_DIFF_BYTES)
        assert len(chunks) == 1
        assert chunks[0] == ""

    def test_large_diff_produces_multiple_chunks(self) -> None:
        # Create a diff with many file sections
        sections = []
        for i in range(100):
            sections.append(f"diff --git a/file{i}.ts b/file{i}.ts\n+export class NewClass{i} {{}}")
        diff = "\n".join(sections)

        chunks = chunk_diff(diff, 1000)  # Small budget to force chunking
        assert len(chunks) > 1
        for chunk in chunks:
            # Each chunk should be within budget (or be a single oversized section)
            chunk_bytes = len(chunk.encode("utf-8"))
            # Allow single sections to exceed if they're larger than budget alone
            if "\ndiff --git " in chunk:
                assert chunk_bytes <= 1000 + 200  # small tolerance for section joining

    def test_chunks_contain_complete_file_sections(self) -> None:
        diff = (
            "diff --git a/a.ts b/a.ts\n-removed line\n"
            "diff --git a/b.ts b/b.ts\n+added line\n"
            "diff --git a/c.ts b/c.ts\n+another added"
        )
        chunks = chunk_diff(diff, 200)
        # Each chunk should start with "diff --git" or be empty
        for chunk in chunks:
            assert chunk.startswith("diff --git ")

    def test_deletion_sections_come_first(self) -> None:
        """Deletion-only sections (priority 1) should be in the first chunk."""
        diff = (
            "diff --git a/new.ts b/new.ts\n+export class NewThing {}\n"
            "diff --git a/removed.ts b/removed.ts\n-export function removed() {}"
        )
        chunks = chunk_diff(diff, 200)
        # First chunk should contain the deletion
        assert "-export function removed() {}" in chunks[0]

    def test_oversized_single_section_gets_own_chunk(self) -> None:
        """A single file section larger than max_bytes gets its own chunk."""
        big_content = "+export class Big {\n" + "+  field: string;\n" * 500
        diff = f"diff --git a/big.ts b/big.ts\n{big_content}\ndiff --git a/small.ts b/small.ts\n+small"
        chunks = chunk_diff(diff, 1000)
        assert len(chunks) >= 2

    def test_all_chunks_within_budget(self) -> None:
        """Each chunk (except oversized single sections) stays within the byte budget."""
        sections = []
        for i in range(50):
            sections.append(f"diff --git a/file{i}.ts b/file{i}.ts\n+export class Class{i} {{}}\n+  value = {i};")
        diff = "\n".join(sections)

        budget = 500
        chunks = chunk_diff(diff, budget)
        for chunk in chunks:
            chunk_bytes = len(chunk.encode("utf-8"))
            # Count how many diff sections are in this chunk
            section_count = chunk.count("diff --git ")
            if section_count <= 1:
                # Single sections may exceed budget
                continue
            assert chunk_bytes <= budget

    def test_priority_ordering_preserved(self) -> None:
        """Sections are ordered by priority: deletions first, then additions."""
        diff = (
            "diff --git a/add1.ts b/add1.ts\n+new file 1\n"
            "diff --git a/del1.ts b/del1.ts\n-removed file 1\n"
            "diff --git a/add2.ts b/add2.ts\n+new file 2\n"
            "diff --git a/del2.ts b/del2.ts\n-removed file 2"
        )
        chunks = chunk_diff(diff, 200)
        # First chunk should have deletions, not additions
        assert "-removed file" in chunks[0]


# ── max_version_bump ─────────────────────────────────────────────────────


class TestMaxVersionBump:
    def test_major_wins_over_minor(self) -> None:
        assert max_version_bump("MAJOR", "MINOR") == "MAJOR"

    def test_minor_wins_over_patch(self) -> None:
        assert max_version_bump("MINOR", "PATCH") == "MINOR"

    def test_patch_wins_over_no_change(self) -> None:
        assert max_version_bump("PATCH", "NO_CHANGE") == "PATCH"

    def test_same_bump_returns_first(self) -> None:
        assert max_version_bump("MINOR", "MINOR") == "MINOR"

    def test_order_independent(self) -> None:
        assert max_version_bump("PATCH", "MAJOR") == "MAJOR"
        assert max_version_bump("NO_CHANGE", "MINOR") == "MINOR"

    @pytest.mark.parametrize(
        "first,second,expected",
        [
            ("MAJOR", "MAJOR", "MAJOR"),
            ("MAJOR", "MINOR", "MAJOR"),
            ("MAJOR", "PATCH", "MAJOR"),
            ("MAJOR", "NO_CHANGE", "MAJOR"),
            ("MINOR", "MAJOR", "MAJOR"),
            ("MINOR", "MINOR", "MINOR"),
            ("MINOR", "PATCH", "MINOR"),
            ("MINOR", "NO_CHANGE", "MINOR"),
            ("PATCH", "MAJOR", "MAJOR"),
            ("PATCH", "MINOR", "MINOR"),
            ("PATCH", "PATCH", "PATCH"),
            ("PATCH", "NO_CHANGE", "PATCH"),
            ("NO_CHANGE", "MAJOR", "MAJOR"),
            ("NO_CHANGE", "MINOR", "MINOR"),
            ("NO_CHANGE", "PATCH", "PATCH"),
            ("NO_CHANGE", "NO_CHANGE", "NO_CHANGE"),
        ],
    )
    def test_exhaustive_pairwise(self, first: str, second: str, expected: str) -> None:
        assert max_version_bump(first, second) == expected


# ── Large-diff e2e tests ─────────────────────────────────────────────────


class TestLargeDiffE2E:
    """End-to-end tests with realistic large diffs (700+ files, 1MB+)."""

    @staticmethod
    def _build_large_java_sdk_diff(num_files: int = 700) -> str:
        """Build a realistic large Java SDK diff with varied file types."""
        sections: list[str] = []
        for i in range(num_files):
            if i % 50 == 0:
                # Deletion-only sections (removed APIs)
                sections.append(
                    f"diff --git a/src/main/java/com/example/api/Removed{i}.java "
                    f"b/src/main/java/com/example/api/Removed{i}.java\n"
                    f"--- a/src/main/java/com/example/api/Removed{i}.java\n"
                    f"+++ /dev/null\n"
                    f"-public class Removed{i} {{\n"
                    f"-    public void execute() {{}}\n"
                    f"-}}"
                )
            elif i % 20 == 0:
                # Mixed with signature changes
                sections.append(
                    f"diff --git a/src/main/java/com/example/api/Client{i}.java "
                    f"b/src/main/java/com/example/api/Client{i}.java\n"
                    f"-public CompletableFuture<Response{i}> get{i}(String id) {{\n"
                    f"+public CompletableFuture<Response{i}> get{i}(String id, Options opts) {{"
                )
            elif i % 10 == 0:
                # Mixed without signatures
                sections.append(
                    f"diff --git a/src/main/java/com/example/internal/Config{i}.java "
                    f"b/src/main/java/com/example/internal/Config{i}.java\n"
                    f"-    private static final int TIMEOUT = 3000;\n"
                    f"+    private static final int TIMEOUT = 5000;"
                )
            else:
                # Addition-only (new files) — the majority
                sections.append(
                    f"diff --git a/src/main/java/com/example/types/Type{i}.java "
                    f"b/src/main/java/com/example/types/Type{i}.java\n"
                    f"+++ b/src/main/java/com/example/types/Type{i}.java\n"
                    f"+package com.example.types;\n"
                    f"+\n"
                    f"+public class Type{i} {{\n"
                    f"+    private String field{i};\n"
                    f"+    public String getField{i}() {{ return field{i}; }}\n"
                    f"+    public void setField{i}(String val) {{ this.field{i} = val; }}\n"
                    f"+}}"
                )
        return "\n".join(sections)

    def test_700_file_diff_chunks_correctly(self) -> None:
        diff = self._build_large_java_sdk_diff(700)
        diff_bytes = len(diff.encode("utf-8"))
        assert diff_bytes > 100_000, f"Diff should be >100KB, got {diff_bytes}"

        chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)
        assert len(chunks) > 1, "700-file diff should produce multiple chunks"

        # Verify all chunks are within budget (except oversized single sections)
        for chunk in chunks:
            chunk_bytes = len(chunk.encode("utf-8"))
            section_count = chunk.count("diff --git ")
            if section_count > 1:
                assert chunk_bytes <= MAX_AI_DIFF_BYTES

    def test_deletion_sections_in_first_chunk(self) -> None:
        diff = self._build_large_java_sdk_diff(700)
        chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)

        # First chunk should contain deletion-only sections (highest priority)
        assert "Removed" in chunks[0], "First chunk should contain deletion sections"
        assert "-public class Removed" in chunks[0]

    def test_signature_sections_early_in_chunks(self) -> None:
        diff = self._build_large_java_sdk_diff(700)
        chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)

        # Signature changes should appear early (first few chunks)
        found_signature_chunk_idx = None
        for idx, chunk in enumerate(chunks):
            if "CompletableFuture" in chunk and "-public" in chunk:
                found_signature_chunk_idx = idx
                break
        assert found_signature_chunk_idx is not None
        # Should be in one of the early chunks (after deletions)
        assert found_signature_chunk_idx < 5

    def test_chunk_count_for_large_diff(self) -> None:
        diff = self._build_large_java_sdk_diff(700)
        chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)
        # With 700 files, expect at least 3 chunks
        assert len(chunks) >= 3

    def test_1000_file_diff_produces_many_chunks(self) -> None:
        diff = self._build_large_java_sdk_diff(1000)
        chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)
        assert len(chunks) > 5

    def test_chunk_cap_enforcement(self) -> None:
        """When chunks exceed MAX_CHUNKS, only the first MAX_CHUNKS are used."""
        diff = self._build_large_java_sdk_diff(1000)
        chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)
        capped = chunks[:MAX_CHUNKS]
        assert len(capped) <= MAX_CHUNKS
        # The capped list should still contain the highest-priority sections
        all_capped = "\n".join(capped)
        assert "Removed" in all_capped

    def test_cross_language_mixed_diff(self) -> None:
        """Test chunking with a mixed-language diff."""
        diff = (
            "diff --git a/src/client.ts b/src/client.ts\n"
            "-export function getUser(id: string): User {\n"
            "+export function getUser(id: string, opts?: Options): User {\n"
            "diff --git a/client.py b/client.py\n"
            "-def get_user(self, user_id: str) -> User:\n"
            "+def get_user(self, user_id: str, timeout: int = 30) -> User:\n"
            "diff --git a/Client.java b/Client.java\n"
            "-public CompletableFuture<User> getUser(String id) {\n"
            "+public CompletableFuture<User> getUser(String id, Options opts) {\n"
            "diff --git a/client.go b/client.go\n"
            "-func GetUser(id string) (*User, error) {\n"
            "+func GetUser(id string, opts ...Option) (*User, error) {\n"
            "diff --git a/src/lib.rs b/src/lib.rs\n"
            "-pub fn get_user(id: &str) -> Result<User, Error> {\n"
            "+pub fn get_user(id: &str, opts: Options) -> Result<User, Error> {\n"
        )
        chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)
        # All sections should be in a single chunk since total is small
        assert len(chunks) == 1
        # All languages should be present
        combined = chunks[0]
        assert "export function" in combined
        assert "def get_user" in combined
        assert "CompletableFuture" in combined
        assert "func GetUser" in combined
        assert "pub fn get_user" in combined

    def test_performance_700_files(self) -> None:
        """Chunking 700 files should complete quickly (<500ms)."""
        import time

        diff = self._build_large_java_sdk_diff(700)
        start = time.monotonic()
        chunk_diff(diff, MAX_AI_DIFF_BYTES)
        elapsed_ms = (time.monotonic() - start) * 1000
        assert elapsed_ms < 500, f"Chunking took {elapsed_ms:.0f}ms, expected <500ms"
