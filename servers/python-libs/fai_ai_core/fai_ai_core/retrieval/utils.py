from dataclasses import dataclass

from .interface import RetrievedDocument


@dataclass
class Citation:
    content: str
    url: str | None = None

    def format(self) -> str:
        if self.url:
            return f"{self.content}\nSource: {self.url}"
        return self.content


def deduplicate_documents(results_list: list[list[RetrievedDocument]]) -> list[RetrievedDocument]:
    docs_by_id: dict[str, RetrievedDocument] = {}
    for results in results_list:
        for doc in results:
            doc_id = doc.document_id or doc.content[:50]
            if doc_id not in docs_by_id:
                docs_by_id[doc_id] = doc
            elif doc.score > docs_by_id[doc_id].score:
                docs_by_id[doc_id] = doc

    docs_by_url: dict[str, RetrievedDocument] = {}
    for doc in docs_by_id.values():
        url = doc.metadata.get("url") if doc.metadata else None
        if url:
            if url not in docs_by_url:
                docs_by_url[url] = doc
            elif doc.score > docs_by_url[url].score:
                docs_by_url[url] = doc
        else:
            docs_by_url[f"__no_url_{id(doc)}"] = doc

    return list(docs_by_url.values())


def extract_citations(documents: list[RetrievedDocument]) -> list[Citation]:
    citations = []
    for doc in documents:
        url = doc.metadata.get("url") if doc.metadata else None
        citations.append(Citation(content=doc.content, url=url))
    return citations


def format_citations(citations: list[Citation]) -> list[str]:
    return [c.format() for c in citations]
