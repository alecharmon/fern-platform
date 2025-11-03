from dataclasses import dataclass


@dataclass
class DocumentChunk:
    content: str
    metadata: dict[str, str | int | list[str] | None]
    full_document: str

    def to_dict(self) -> dict[str, str | dict[str, str | int | list[str] | None]]:
        return {"content": self.content, "metadata": self.metadata, "full_document": self.full_document}
