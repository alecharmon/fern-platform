import re
from dataclasses import dataclass

MAX_AI_DIFF_BYTES = 40_000

MAX_CHUNKS = 40

MAX_RAW_DIFF_BYTES = 10_000_000

SIGNATURE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^[+-]\s*export\s+(function|class|interface|type|enum|const|let|var|default)\s+"),
    re.compile(r"^[+-]\s*public\s+"),
    re.compile(
        r"^[+-]\s*(public|protected|private)\s+(static\s+)?(class|interface|enum|record|void|"
        r"int|long|boolean|String|Optional|List|Map|Set|CompletableFuture|[A-Z])"
    ),
    re.compile(r"^[+-]\s*open\s+(class|func)\s+"),
    re.compile(r"^[+-]\s*def\s+"),
    re.compile(r"^[+-]\s*class\s+[A-Z]"),
    re.compile(r"^[+-]\s*module\s+[A-Z]"),
    re.compile(r"^[+-]\s*func\s+[A-Z]"),
    re.compile(r"^[+-]\s*func\s+\([^)]+\)\s+[A-Z]"),
    re.compile(r"^[+-]\s*type\s+[A-Z]"),
    re.compile(r"^[+-]\s*pub\s+(fn|struct|enum|trait|type|mod)\s+"),
    re.compile(r"^[+-]\s*function\s+"),
]


@dataclass
class FileSection:
    lines: list[str]


@dataclass
class RankedSection:
    text: str
    priority: int


def _is_diff_header(line: str) -> bool:
    return (
        line.startswith("--- a/") or line.startswith("--- /dev/null")
        or line.startswith("+++ b/") or line.startswith("+++ /dev/null")
    )


def _is_change_line(line: str, prefix: str) -> bool:
    if len(line) == 0 or line[0] != prefix:
        return False
    return not _is_diff_header(line)


def _matches_any_signature(line: str) -> bool:
    for pattern in SIGNATURE_PATTERNS:
        if pattern.search(line):
            return True
    return False


def classify_section(section: FileSection) -> int:
    has_additions = False
    has_deletions = False
    has_signature = False

    for line in section.lines:
        has_additions = has_additions or _is_change_line(line, "+")
        has_deletions = has_deletions or _is_change_line(line, "-")

        if not has_signature and (_is_change_line(line, "+") or _is_change_line(line, "-")):
            has_signature = _matches_any_signature(line)

        if has_additions and has_deletions and has_signature:
            break

    if has_deletions and not has_additions:
        return 1
    if has_deletions and has_signature:
        return 2
    if has_deletions:
        return 3
    if has_additions:
        return 4
    return 5


def parse_file_sections(lines: list[str]) -> list[FileSection]:
    sections: list[FileSection] = []
    current_lines: list[str] = []

    for line in lines:
        if line.startswith("diff --git ") and current_lines:
            sections.append(FileSection(lines=current_lines))
            current_lines = []
        current_lines.append(line)

    if current_lines:
        sections.append(FileSection(lines=current_lines))

    return sections


def _rank_sections(file_sections: list[FileSection]) -> list[RankedSection]:
    ranked = []
    for section in file_sections:
        text = "\n".join(section.lines)
        priority = classify_section(section)
        ranked.append(RankedSection(text=text, priority=priority))
    ranked.sort(key=lambda entry: entry.priority)
    return ranked


def chunk_diff(diff: str, max_bytes_per_chunk: int = MAX_AI_DIFF_BYTES) -> list[str]:
    lines = diff.split("\n")
    file_sections = parse_file_sections(lines)

    if not file_sections:
        return [diff]

    ranked = _rank_sections(file_sections)

    chunks: list[str] = []
    current_chunk_texts: list[str] = []
    current_chunk_bytes = 0

    for entry in ranked:
        section_bytes = len(entry.text.encode("utf-8"))
        newline_bytes = 0 if not current_chunk_texts else 1

        if section_bytes > max_bytes_per_chunk:
            if current_chunk_texts:
                chunks.append("\n".join(current_chunk_texts))
                current_chunk_texts = []
            current_chunk_bytes = 0
            chunks.append(entry.text)
            continue

        if current_chunk_bytes + section_bytes + newline_bytes > max_bytes_per_chunk and current_chunk_texts:
            chunks.append("\n".join(current_chunk_texts))
            current_chunk_texts = []
            current_chunk_bytes = 0

        current_chunk_texts.append(entry.text)
        current_chunk_bytes += section_bytes + (1 if len(current_chunk_texts) > 1 else 0)

    if current_chunk_texts:
        chunks.append("\n".join(current_chunk_texts))

    return chunks


def max_version_bump(first: str, second: str) -> str:
    priority = {"MAJOR": 4, "MINOR": 3, "PATCH": 2, "NO_CHANGE": 1}
    first_priority = priority.get(first, 0)
    second_priority = priority.get(second, 0)
    return first if first_priority >= second_priority else second
