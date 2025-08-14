def format_document_for_tpuf(chunk: str, document: str) -> str:
    return (
        "<GUIDANCE>\n"
        f"In response to the following query:\n{chunk}\n\n"
        f"You will return an answer based on the following guidance:\n{document}\n"
        "</GUIDANCE>"
    )
