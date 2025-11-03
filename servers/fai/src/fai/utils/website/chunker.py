import re

from fai.utils.website.models import DocumentChunk


class MarkdownChunker:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, min_chunk_size: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size

    def chunk_document(
        self, markdown_content: str, title: str, metadata: dict[str, str | list[str] | None]
    ) -> list[DocumentChunk]:
        chunks: list[DocumentChunk] = []
        sections = self._split_by_headers(markdown_content)

        for section in sections:
            section_chunks = self._chunk_section(section, title, metadata, markdown_content)
            chunks.extend(section_chunks)

        return chunks

    def _split_by_headers(self, markdown: str) -> list[dict[str, str | int | None]]:
        sections: list[dict[str, str | int | None]] = []
        lines = markdown.split("\n")

        current_lines: list[str] = []
        current_heading: str | None = None
        current_level: int = 0

        for line in lines:
            header_match = re.match(r"^(#{1,6})\s+(.+)$", line)

            if header_match:
                if current_lines:
                    sections.append(
                        {"heading": current_heading, "level": current_level, "content": "\n".join(current_lines)}
                    )

                current_level = len(header_match.group(1))
                current_heading = header_match.group(2).strip()
                current_lines = []
            else:
                current_lines.append(line)

        if current_lines:
            sections.append({"heading": current_heading, "level": current_level, "content": "\n".join(current_lines)})

        if not sections and markdown.strip():
            sections.append({"heading": None, "level": 0, "content": markdown})

        return sections

    def _chunk_section(
        self,
        section: dict[str, str | int | None],
        doc_title: str,
        base_metadata: dict[str, str | list[str] | None],
        full_document: str,
    ) -> list[DocumentChunk]:
        chunks: list[DocumentChunk] = []
        heading_val = section["heading"]
        level_val = section["level"]
        content_val = section["content"]

        heading: str | None = heading_val if isinstance(heading_val, str) or heading_val is None else None
        level: int = level_val if isinstance(level_val, int) else 0
        content: str = content_val.strip() if isinstance(content_val, str) else ""

        if not content or len(content) < self.min_chunk_size:
            return chunks

        if len(content) <= self.chunk_size:
            chunk_content = content

            if heading:
                chunk_content = f"# {heading}\n\n{chunk_content}"

            chunks.append(
                DocumentChunk(
                    content=chunk_content,
                    metadata={
                        "document_title": doc_title,
                        "section_heading": heading,
                        "heading_level": level,
                        "chunk_type": "section",
                        **base_metadata,
                    },
                    full_document=full_document,
                )
            )
        else:
            text_chunks = self._split_with_overlap(content)

            filtered_chunks = [(i, chunk_text) for i, chunk_text in enumerate(text_chunks)
                             if len(chunk_text.strip()) >= self.min_chunk_size]

            total_filtered = len(filtered_chunks)

            for part_num, (original_index, chunk_text) in enumerate(filtered_chunks, start=1):
                if heading and original_index == 0:
                    chunk_content = f"# {heading}\n\n{chunk_text}"
                elif heading:
                    chunk_content = f"[Continuing from: {heading}]\n\n{chunk_text}"
                else:
                    chunk_content = chunk_text

                chunks.append(
                    DocumentChunk(
                        content=chunk_content,
                        metadata={
                            "document_title": doc_title,
                            "section_heading": heading,
                            "heading_level": level,
                            "chunk_type": "section_part",
                            "part_number": part_num,
                            "total_parts": total_filtered,
                            **base_metadata,
                        },
                        full_document=full_document,
                    )
                )

        return chunks

    def _split_with_overlap(self, text: str) -> list[str]:
        if len(text) <= self.chunk_size:
            return [text]

        chunks: list[str] = []
        paragraphs = re.split(r"\n\n+", text)
        current_chunk: list[str] = []
        current_length = 0

        for para in paragraphs:
            para_length = len(para)

            if current_length + para_length > self.chunk_size and current_chunk:
                chunks.append("\n\n".join(current_chunk))

                overlap_paras: list[str] = []
                overlap_length = 0

                for p in reversed(current_chunk):
                    if overlap_length + len(p) <= self.chunk_overlap:
                        overlap_paras.insert(0, p)
                        overlap_length += len(p)
                    else:
                        break

                current_chunk = overlap_paras
                current_length = overlap_length

            current_chunk.append(para)
            current_length += para_length

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        return chunks
