"""Create chunked records from markdown files."""

import html
import re
from pathlib import Path
from typing import (
    Any,
    Literal,
    TypedDict,
)

from ..models import MarkdownFileDocument


class HeadingInfo(TypedDict):
    """Information about a heading."""

    depth: int
    title: str


class RootSection(TypedDict):
    """A root section without a heading."""

    type: Literal["root"]
    heading: None
    content: str


class HeadingSection(TypedDict):
    """A section with a heading."""

    type: Literal["heading"]
    heading: HeadingInfo
    content: str


Section = RootSection | HeadingSection


class ParsedMarkdown(TypedDict):
    """Parsed markdown with frontmatter and content."""

    frontmatter: dict[str, Any]
    content: str


async def chunk_markdown_file(
    file_path: Path,
    url: str | None = None,
    github_url: str | None = None,
    global_keywords: list[str] | None = None,
    repo_name: str | None = None,
) -> list[MarkdownFileDocument]:
    """Convert a markdown file into chunked document records.

    Args:
        file_path: Path to the markdown file
        url: Optional URL for the document
        github_url: Optional GitHub URL for the file
        global_keywords: Optional list of keywords to add to all records
        repo_name: Optional repository name to use as title prefix

    Returns:
        List of MarkdownFileDocument objects ready for indexing
    """
    with open(file_path, encoding="utf-8") as f:
        markdown_content = f.read()

    title = repo_name if repo_name else file_path.stem.replace("-", " ")

    filename_keyword = file_path.stem
    keywords_with_filename = [filename_keyword]
    if global_keywords:
        keywords_with_filename.extend(global_keywords)

    sections = split_into_sections(markdown_content, split_depth=3)

    records: list[MarkdownFileDocument] = []

    heading_stack: dict[int, str] = {}

    for section in sections:
        if section["type"] == "root":
            root_content = clean_content(section["content"])
            if root_content:
                chunked_content = chunk_to_bytes(root_content, 50 * 1000)
                for chunk in chunked_content:
                    keywords = _build_keywords([], keywords_with_filename)
                    record = MarkdownFileDocument(
                        file_path=str(file_path),
                        relative_path=file_path.name,
                        file_name=file_path.name,
                        github_url=github_url,
                        document=markdown_content,
                        chunk=chunk,
                        title=title,
                        url=url or "",
                        keywords=keywords,
                    )
                    records.append(record)
        else:
            heading = section["heading"]
            section_content = section["content"]
            depth = heading["depth"]

            heading_line = f"{'#' * depth} {heading['title']}"
            cleaned = clean_content(section_content)

            if cleaned and cleaned.strip().startswith(heading_line):
                body_content = cleaned[len(heading_line) :].strip()
            else:
                body_content = cleaned

            keys_to_remove = [d for d in heading_stack.keys() if d >= depth]
            for key in keys_to_remove:
                del heading_stack[key]

            heading_title = decode_html_entities(markdown_to_string(heading["title"]) or "")
            heading_stack[depth] = f"{'#' * depth} {heading_title}"

            if not body_content or not body_content.strip():
                continue

            chunk_parts = []
            for d in sorted(heading_stack.keys()):
                chunk_parts.append(heading_stack[d])
            chunk_parts.append(body_content)

            content_with_hierarchy = "\n\n".join(chunk_parts)

            chunked_content = chunk_to_bytes(content_with_hierarchy, 50 * 1000)

            heading_texts = [heading_stack[d].lstrip("#").strip() for d in sorted(heading_stack.keys())]
            keywords = _build_keywords(heading_texts, keywords_with_filename)

            for chunk in chunked_content:
                record = MarkdownFileDocument(
                    file_path=str(file_path),
                    relative_path=file_path.name,
                    file_name=file_path.name,
                    github_url=github_url,
                    document=markdown_content,
                    chunk=chunk,
                    title=title,
                    url=url or "",
                    keywords=keywords,
                )
                records.append(record)

    return records


def _build_keywords(
    heading_texts: list[str],
    global_keywords: list[str] | None,
) -> list[str]:
    """Build keywords list with deduplication."""
    keywords = []

    for heading_text in heading_texts:
        if heading_text not in keywords:
            keywords.append(heading_text)

    if global_keywords:
        for keyword in global_keywords:
            if keyword not in keywords:
                keywords.append(keyword)

    return keywords


def parse_markdown(content: str) -> ParsedMarkdown:
    """Parse markdown content and extract frontmatter.

    Args:
        content: The markdown content

    Returns:
        Dictionary with frontmatter and content
    """
    frontmatter: dict[str, Any] = {}
    markdown_content = content

    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter_text = parts[1].strip()
            markdown_content = parts[2].strip()

            for line in frontmatter_text.split("\n"):
                if ":" in line:
                    key, value_str = line.split(":", 1)
                    key = key.strip()
                    value_str = value_str.strip()

                    if value_str.startswith("[") and value_str.endswith("]"):
                        frontmatter[key] = [v.strip().strip('"').strip("'") for v in value_str[1:-1].split(",")]
                    else:
                        frontmatter[key] = value_str

    return ParsedMarkdown(frontmatter=frontmatter, content=markdown_content)


def split_into_sections(content: str, split_depth: int = 2) -> list[Section]:
    """Split markdown content into sections by headings.

    Args:
        content: The markdown content
        split_depth: The heading depth to split on (1=h1, 2=h2, 3=h3, etc.)
                    All headings at or above this depth create new sections.
                    For example:
                    - split_depth=2: Split on h1 and h2 (h3-h6 stay with parent)
                    - split_depth=3: Split on h1, h2, and h3 (h4-h6 stay with parent)

    Returns:
        List of sections
    """
    sections: list[Section] = []
    lines = content.split("\n")

    current_section: list[str] = []
    current_heading: HeadingInfo | None = None

    for line in lines:
        heading_match = re.match(r"^(#{1,6})\s+(.+)$", line)

        if heading_match:
            depth = len(heading_match.group(1))
            heading_text = heading_match.group(2).strip()

            if depth <= split_depth:
                if current_section:
                    section_content = "\n".join(current_section)
                    if current_heading is None:
                        sections.append(RootSection(type="root", heading=None, content=section_content))
                    else:
                        sections.append(
                            HeadingSection(type="heading", heading=current_heading, content=section_content)
                        )

                current_heading = HeadingInfo(depth=depth, title=heading_text)
                current_section = [line]
            else:
                current_section.append(line)
        else:
            current_section.append(line)

    if current_section:
        section_content = "\n".join(current_section)
        if current_heading is None:
            sections.append(RootSection(type="root", heading=None, content=section_content))
        else:
            sections.append(HeadingSection(type="heading", heading=current_heading, content=section_content))

    return sections


def markdown_to_string(value: Any) -> str | None:
    """Convert a value to a plain string, stripping markdown formatting.

    Args:
        value: The value to convert

    Returns:
        Plain string or None
    """
    if value is None:
        return None

    text = str(value)

    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)

    return text.strip()


def decode_html_entities(text: str) -> str:
    """Decode HTML entities in text.

    Args:
        text: The text to decode

    Returns:
        Decoded text
    """
    return html.unescape(text)


def clean_content(content: str) -> str:
    """Clean and normalize markdown content.

    Args:
        content: The content to clean

    Returns:
        Cleaned content
    """
    # Remove excessive whitespace
    lines = content.split("\n")
    cleaned_lines = []

    for line in lines:
        # Strip trailing whitespace
        line = line.rstrip()
        cleaned_lines.append(line)

    # Join and collapse multiple blank lines
    text = "\n".join(cleaned_lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def chunk_to_bytes(content: str, max_bytes: int) -> list[str]:
    """Chunk content to fit within byte limit while preserving code blocks.

    Args:
        content: The content to chunk
        max_bytes: Maximum bytes per chunk

    Returns:
        List of chunks
    """
    chunks: list[str] = []

    if len(content.encode("utf-8")) <= max_bytes:
        return [content]

    blocks = _split_preserving_code_blocks(content)

    current_chunk: list[str] = []
    current_size = 0

    for block in blocks:
        block_bytes = len(block.encode("utf-8"))

        if block_bytes > max_bytes and not _is_code_block(block):
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_size = 0

            sentences = re.split(r"(?<=[.!?])\s+", block)
            for sentence in sentences:
                sentence_bytes = len(sentence.encode("utf-8"))
                if current_size + sentence_bytes + 1 > max_bytes and current_chunk:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = []
                    current_size = 0
                current_chunk.append(sentence)
                current_size += sentence_bytes + 1

            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_size = 0
        else:
            if current_size + block_bytes + 2 > max_bytes and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_size = 0

            current_chunk.append(block)
            current_size += block_bytes + 2

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks


def _split_preserving_code_blocks(content: str) -> list[str]:
    """Split content into blocks, keeping code blocks intact.

    Args:
        content: The content to split

    Returns:
        List of blocks (code blocks and regular paragraphs)
    """
    blocks: list[str] = []
    lines = content.split("\n")
    current_block: list[str] = []
    in_code_block = False

    for line in lines:
        if line.strip().startswith("```"):
            if in_code_block:
                current_block.append(line)
                blocks.append("\n".join(current_block))
                current_block = []
                in_code_block = False
            else:
                if current_block:
                    non_code_text = "\n".join(current_block)
                    paragraphs = non_code_text.split("\n\n")
                    blocks.extend([p for p in paragraphs if p.strip()])
                    current_block = []

                current_block.append(line)
                in_code_block = True
        elif in_code_block:
            current_block.append(line)
        else:
            current_block.append(line)

    if current_block:
        if in_code_block:
            blocks.append("\n".join(current_block))
        else:
            non_code_text = "\n".join(current_block)
            paragraphs = non_code_text.split("\n\n")
            blocks.extend([p for p in paragraphs if p.strip()])

    return blocks


def _is_code_block(text: str) -> bool:
    """Check if a text block is a code block.

    Args:
        text: The text to check

    Returns:
        True if the text is a code block
    """
    return text.strip().startswith("```") and text.strip().endswith("```")
