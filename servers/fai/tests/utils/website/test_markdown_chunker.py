import pytest

from fai.utils.website.chunker import MarkdownChunker


class TestMarkdownChunker:
    @pytest.fixture
    def chunker(self) -> MarkdownChunker:
        return MarkdownChunker(chunk_size=1000, chunk_overlap=200, min_chunk_size=100)

    @pytest.fixture
    def small_chunker(self) -> MarkdownChunker:
        return MarkdownChunker(chunk_size=100, chunk_overlap=20, min_chunk_size=10)

    @pytest.fixture
    def sample_markdown_with_headers(self) -> str:
        return """# Introduction

This is the introduction paragraph with some content that provides enough detail to meet minimum chunk size
requirements.

## Getting Started

Here's how to get started with the project. Follow these detailed instructions carefully to ensure proper setup.

### Installation

Run the following command to install the software. Make sure you have all prerequisites installed first.

### Configuration

Configure your settings here with the appropriate values. Review the configuration guide for more details.

## Advanced Topics

This section covers advanced topics including performance tuning, security, and deployment strategies for production.
"""

    @pytest.fixture
    def sample_markdown_no_headers(self) -> str:
        return """This is plain text without any headers.
Just paragraphs of content that should be treated as a single section.

Another paragraph here with more information."""

    @pytest.fixture
    def sample_long_section(self) -> str:
        paragraphs = [f"This is paragraph number {i}." for i in range(50)]
        return "# Long Section\n\n" + "\n\n".join(paragraphs)

    def test_split_by_headers_single_header(self, chunker: MarkdownChunker) -> None:
        markdown = "# Title\n\nSome content here."
        sections = chunker._split_by_headers(markdown)

        assert len(sections) == 1
        assert sections[0]["heading"] == "Title"
        assert sections[0]["level"] == 1
        assert "Some content here" in sections[0]["content"]

    def test_split_by_headers_multiple_headers(self, chunker: MarkdownChunker) -> None:
        markdown = """# H1 Title

Content for H1.

## H2 Subtitle

Content for H2.

### H3 Section

Content for H3.
"""
        sections = chunker._split_by_headers(markdown)

        assert len(sections) == 3
        assert sections[0]["heading"] == "H1 Title"
        assert sections[0]["level"] == 1
        assert sections[1]["heading"] == "H2 Subtitle"
        assert sections[1]["level"] == 2
        assert sections[2]["heading"] == "H3 Section"
        assert sections[2]["level"] == 3

    def test_split_by_headers_no_headers(self, chunker: MarkdownChunker) -> None:
        markdown = "Just plain text\n\nWith multiple paragraphs."
        sections = chunker._split_by_headers(markdown)

        assert len(sections) == 1
        assert sections[0]["heading"] is None
        assert sections[0]["level"] == 0
        assert "plain text" in sections[0]["content"]

    def test_split_by_headers_empty_string(self, chunker: MarkdownChunker) -> None:
        markdown = ""
        sections = chunker._split_by_headers(markdown)

        # Empty string should return no sections or one empty section
        assert len(sections) <= 1
        if len(sections) == 1:
            assert sections[0]["heading"] is None
            assert sections[0]["level"] == 0

    def test_split_by_headers_whitespace_only_content(self, chunker: MarkdownChunker) -> None:
        markdown = "   \n\n  "  # Whitespace only
        sections = chunker._split_by_headers(markdown)

        # The implementation treats whitespace as content and returns one section
        assert len(sections) == 1
        assert sections[0]["heading"] is None
        assert sections[0]["level"] == 0

    def test_split_by_headers_headers_only(self, chunker: MarkdownChunker) -> None:
        markdown = "# Title\n## Subtitle\n"
        sections = chunker._split_by_headers(markdown)

        # Headers without content after them get only the last one with empty content
        # The implementation only adds sections when there are content lines
        assert len(sections) == 1
        assert sections[0]["heading"] == "Subtitle"
        assert sections[0]["content"].strip() == ""

    def test_split_with_overlap_short_text(self, chunker: MarkdownChunker) -> None:
        text = "This is a short text that fits in one chunk."
        chunks = chunker._split_with_overlap(text)

        assert len(chunks) == 1
        assert chunks[0] == text

    def test_split_with_overlap_long_text(self, small_chunker: MarkdownChunker) -> None:
        # Create text longer than chunk_size (100 chars)
        paragraphs = [f"Paragraph {i} with some text." for i in range(10)]
        text = "\n\n".join(paragraphs)

        chunks = small_chunker._split_with_overlap(text)

        # Should have multiple chunks
        assert len(chunks) > 1

        # Check that chunks overlap
        for i in range(len(chunks) - 1):
            # Some content from end of chunk[i] should appear at start of chunk[i+1]
            # This is a simplified check - actual overlap is at paragraph boundaries
            assert len(chunks[i]) <= small_chunker.chunk_size + 50  # Allow some flexibility

    def test_split_with_overlap_respects_paragraph_boundaries(self, small_chunker: MarkdownChunker) -> None:
        text = "Para 1.\n\nPara 2.\n\nPara 3.\n\nPara 4.\n\nPara 5."
        chunks = small_chunker._split_with_overlap(text)

        # Each chunk should contain complete paragraphs (not split mid-paragraph)
        for chunk in chunks:
            # Chunks should not contain single newlines (only double \n\n paragraph separators)
            # Single newlines would indicate a paragraph was split in the middle
            lines = chunk.split("\n\n")
            for line in lines:
                # Each paragraph should not contain internal newlines
                assert "\n" not in line.strip() or line.strip() == ""

    def test_chunk_document_small_content(self, chunker: MarkdownChunker) -> None:
        markdown = (
            "# Simple Document\n\nThis is a simple document with enough content to meet the minimum "
            "chunk size requirements. We need at least 100 characters to pass the minimum threshold."
        )
        title = "Test Document"
        metadata = {"url": "https://example.com/test"}

        chunks = chunker.chunk_document(markdown, title, metadata)

        assert len(chunks) == 1
        assert chunks[0].metadata["document_title"] == title
        assert chunks[0].metadata["section_heading"] == "Simple Document"
        assert chunks[0].metadata["chunk_type"] == "section"
        assert "Simple Document" in chunks[0].content

    def test_chunk_document_respects_min_chunk_size(self, chunker: MarkdownChunker) -> None:
        # Create markdown with very short section
        markdown = "# Tiny\n\nSmall."
        title = "Test"
        metadata = {"url": "https://example.com/test"}

        chunks = chunker.chunk_document(markdown, title, metadata)

        # Should be filtered out due to min_chunk_size=100
        assert len(chunks) == 0

    def test_chunk_document_multiple_sections(
        self, chunker: MarkdownChunker, sample_markdown_with_headers: str
    ) -> None:
        title = "Documentation Guide"
        metadata = {"url": "https://example.com/guide"}

        chunks = chunker.chunk_document(sample_markdown_with_headers, title, metadata)

        # Should have multiple chunks for different sections
        assert len(chunks) > 1

        # Check that sections are properly labeled
        headings = [chunk.metadata.get("section_heading") for chunk in chunks]
        assert "Introduction" in headings
        assert "Getting Started" in headings

    def test_chunk_document_preserves_heading_in_content(self, chunker: MarkdownChunker) -> None:
        markdown = (
            "# Important Section\n\nThis is the content of the section with enough text to meet "
            "minimum requirements for chunking and processing properly with all necessary details."
        )
        title = "Test Document"
        metadata = {"url": "https://example.com/test"}

        chunks = chunker.chunk_document(markdown, title, metadata)

        assert len(chunks) == 1
        # Heading should be included in the content
        assert "# Important Section" in chunks[0].content
        assert "content of the section" in chunks[0].content

    def test_chunk_document_large_section_split(self, small_chunker: MarkdownChunker, sample_long_section: str) -> None:
        title = "Long Document"
        metadata = {"url": "https://example.com/long"}

        chunks = small_chunker.chunk_document(sample_long_section, title, metadata)

        # Should be split into multiple chunks
        assert len(chunks) > 1

        # Check part numbering
        for chunk in chunks:
            if chunk.metadata["chunk_type"] == "section_part":
                assert "part_number" in chunk.metadata
                assert "total_parts" in chunk.metadata
                assert chunk.metadata["part_number"] <= chunk.metadata["total_parts"]

    def test_chunk_document_continuation_markers(
        self, small_chunker: MarkdownChunker, sample_long_section: str
    ) -> None:
        title = "Long Document"
        metadata = {"url": "https://example.com/long"}

        chunks = small_chunker.chunk_document(sample_long_section, title, metadata)

        # Find chunks that are continuations
        continuation_chunks = [
            c for c in chunks if c.metadata.get("chunk_type") == "section_part" and c.metadata.get("part_number", 1) > 1
        ]

        # Continuation chunks should have continuation marker
        for chunk in continuation_chunks:
            assert "[Continuing from:" in chunk.content

    def test_chunk_document_metadata_propagation(self, chunker: MarkdownChunker) -> None:
        markdown = "# Section 1\n\nContent 1.\n\n# Section 2\n\nContent 2."
        title = "Test Document"
        base_metadata = {
            "url": "https://example.com/test",
            "description": "Test description",
            "url_path": ["docs", "test"],
        }

        chunks = chunker.chunk_document(markdown, title, base_metadata)

        # All chunks should have base metadata
        for chunk in chunks:
            assert chunk.metadata["url"] == "https://example.com/test"
            assert chunk.metadata["description"] == "Test description"
            assert chunk.metadata["url_path"] == ["docs", "test"]
            assert chunk.metadata["document_title"] == title

    def test_chunk_document_no_headers(self, chunker: MarkdownChunker, sample_markdown_no_headers: str) -> None:
        title = "Plain Document"
        metadata = {"url": "https://example.com/plain"}

        chunks = chunker.chunk_document(sample_markdown_no_headers, title, metadata)

        # Should create chunk with no section heading
        assert len(chunks) == 1
        assert chunks[0].metadata["section_heading"] is None
        assert chunks[0].metadata["heading_level"] == 0

    def test_chunk_section_includes_heading_level(self, chunker: MarkdownChunker) -> None:
        section = {
            "heading": "Test Section",
            "level": 2,
            "content": (
                "Content here with enough text to meet minimum chunk size requirements. "
                "Adding more text to ensure we pass the threshold."
            ),
        }
        title = "Document"
        metadata = {"url": "https://example.com"}
        full_document = (
            "## Test Section\n\nContent here with enough text to meet minimum chunk size "
            "requirements. Adding more text to ensure we pass the threshold."
        )

        chunks = chunker._chunk_section(section, title, metadata, full_document)

        assert len(chunks) == 1
        assert chunks[0].metadata["heading_level"] == 2

    def test_chunk_section_empty_content(self, chunker: MarkdownChunker) -> None:
        section = {"heading": "Empty Section", "level": 1, "content": ""}
        title = "Document"
        metadata = {"url": "https://example.com"}
        full_document = "# Empty Section\n\n"

        chunks = chunker._chunk_section(section, title, metadata, full_document)

        assert len(chunks) == 0

    def test_chunk_section_content_below_min_size(self, chunker: MarkdownChunker) -> None:
        section = {"heading": "Tiny", "level": 1, "content": "Too small."}
        title = "Document"
        metadata = {"url": "https://example.com"}
        full_document = "# Tiny\n\nToo small."

        chunks = chunker._chunk_section(section, title, metadata, full_document)

        # Should be filtered out (min_chunk_size=100)
        assert len(chunks) == 0

    def test_document_chunk_to_dict(self, chunker: MarkdownChunker) -> None:
        markdown = (
            "# Test\n\nContent here with enough text to create a proper chunk that meets "
            "minimum size requirements for the chunker."
        )
        title = "Test"
        metadata = {"url": "https://example.com"}

        chunks = chunker.chunk_document(markdown, title, metadata)
        assert len(chunks) > 0, "Should have at least one chunk"
        chunk_dict = chunks[0].to_dict()

        assert "content" in chunk_dict
        assert "metadata" in chunk_dict
        assert isinstance(chunk_dict["content"], str)
        assert isinstance(chunk_dict["metadata"], dict)

    def test_chunk_size_parameter_respected(self) -> None:
        # Create very small chunk size
        small_chunker = MarkdownChunker(chunk_size=200, chunk_overlap=50, min_chunk_size=10)

        # Create content longer than chunk_size to force splitting
        paragraphs = [f"This is a detailed paragraph number {i} with substantial content." for i in range(20)]
        long_content = "\n\n".join(paragraphs)
        markdown = f"# Section\n\n{long_content}"

        chunks = small_chunker.chunk_document(markdown, "Test", {"url": "https://example.com"})

        # Should be split into multiple chunks
        assert len(chunks) > 1

    def test_chunk_overlap_parameter_respected(self) -> None:
        chunker = MarkdownChunker(chunk_size=100, chunk_overlap=50, min_chunk_size=10)

        # Create content that will be split
        paragraphs = [f"Para {i}. " * 5 for i in range(10)]
        text = "\n\n".join(paragraphs)

        chunks = chunker._split_with_overlap(text)

        # Should have multiple chunks
        assert len(chunks) > 1

        # Verify overlap: content from end of chunk[i] should appear at start of chunk[i+1]
        for i in range(len(chunks) - 1):
            # Get the last paragraph(s) of current chunk
            current_paragraphs = chunks[i].split("\n\n")
            chunks[i + 1].split("\n\n")

            # At least one paragraph from current chunk should appear in next chunk
            overlap_found = False
            for para in current_paragraphs[-3:]:  # Check last few paragraphs
                if para.strip() and para in chunks[i + 1]:
                    overlap_found = True
                    break

            assert overlap_found, f"No overlap found between chunk {i} and {i+1}"

    def test_part_numbers_sequential_after_filtering(self) -> None:
        chunker = MarkdownChunker(chunk_size=100, chunk_overlap=20, min_chunk_size=40)
        markdown = "# Test\n\n" + "A" * 90 + "\n\n" + "B" * 30 + "\n\n" + "C" * 90

        chunks = chunker.chunk_document(markdown, "Test", {"url": "test"})
        section_parts = [c for c in chunks if c.metadata.get("chunk_type") == "section_part"]

        assert len(section_parts) == 2, f"Expected 2 chunks after filtering, got {len(section_parts)}"

        part_numbers = [c.metadata["part_number"] for c in section_parts]
        expected_part_numbers = list(range(1, len(section_parts) + 1))
        assert (
            part_numbers == expected_part_numbers
        ), f"Part numbers {part_numbers} are not sequential. Expected {expected_part_numbers}"

        for chunk in section_parts:
            assert chunk.metadata["total_parts"] == len(
                section_parts
            ), f"total_parts is {chunk.metadata['total_parts']} but actual chunks: {len(section_parts)}"

    def test_heading_hierarchy_preserved_in_metadata(self, chunker: MarkdownChunker) -> None:
        markdown = """# H1
Content for H1 with enough text to meet the minimum chunk size requirements for proper testing and validation.

## H2
Content for H2 with enough text to meet the minimum chunk size requirements for proper testing and validation.

### H3
Content for H3 with enough text to meet the minimum chunk size requirements for proper testing and validation.

#### H4
Content for H4 with enough text to meet the minimum chunk size requirements for proper testing and validation.
"""
        chunks = chunker.chunk_document(markdown, "Test", {"url": "https://example.com"})

        # Check that levels are correctly assigned
        levels = [chunk.metadata["heading_level"] for chunk in chunks]
        assert 1 in levels  # H1
        assert 2 in levels  # H2
        assert 3 in levels  # H3
        assert 4 in levels  # H4
