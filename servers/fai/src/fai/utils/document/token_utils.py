import tiktoken

from fai.settings import CONFIG


def maybe_chunk_document(chunk: str) -> list[str]:
    if count_tokens(chunk) >= 8192:
        chunks = split_on_token(chunk, 4096)
    else:
        chunks = [chunk]
    return chunks


def count_tokens(text: str, model: str = CONFIG.DEFAULT_EMBEDDING_MODEL.model_name) -> int:
    """Count the number of tokens in a text using tiktoken.

    Args:
        text: The text to count tokens for
        model: The model to use for tokenization (default: text-embedding-3-large)

    Returns:
        The number of tokens in the text
    """
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))


def split_on_token(text: str, token_length: int, model: str = CONFIG.DEFAULT_EMBEDDING_MODEL.model_name) -> list[str]:
    """Split text into chunks where each chunk has at most token_length tokens.

    Args:
        text: The text to split
        token_length: The maximum number of tokens per chunk
        model: The model to use for tokenization (default: text-embedding-3-large)

    Returns:
        A list of text chunks, each with at most token_length tokens
    """
    encoding = tiktoken.encoding_for_model(model)
    tokens = encoding.encode(text)

    chunks = []
    for i in range(0, len(tokens), token_length):
        chunk_tokens = tokens[i : i + token_length]
        chunk_text = encoding.decode(chunk_tokens)
        chunks.append(chunk_text)

    return chunks
