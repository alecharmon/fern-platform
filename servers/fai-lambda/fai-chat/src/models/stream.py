from dataclasses import dataclass

from ..retrieval.interface import RetrievedDocument


@dataclass
class Source:
    title: str
    url: str


def convert_documents_to_sources(documents: list[RetrievedDocument]) -> list[Source]:
    return [
        Source(
            title=doc.metadata.get("title", "") if doc.metadata else "",
            url=doc.metadata.get("url", "") if doc.metadata else "",
        )
        for doc in documents
    ]
