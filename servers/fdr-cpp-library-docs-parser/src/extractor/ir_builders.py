"""Shared IR construction helpers for building CppDocSegment and CppDocBlock instances."""

from src.generated import (
    CppCodeBlock,
    CppDocBlock,
    CppDocBoldSegment,
    CppDocCodeRefSegment,
    CppDocCodeSegment,
    CppDocEmphasisSegment,
    CppDocLinkSegment,
    CppDocRefSegment,
    CppDocSegment,
    CppDocSubscriptSegment,
    CppDocSuperscriptSegment,
    CppDocTextSegment,
    CppImageBlock,
    CppParagraphBlock,
)


def _make_doc_block(variant) -> CppDocBlock:
    """Construct CppDocBlock with pydantic v1/v2 compatibility.

    The generated factory methods have bugs with certain variant types
    (duplicate 'type' kwargs, alias mismatches). This helper bypasses
    the factory by wrapping a pre-built variant object directly.
    """
    from src.generated.core.pydantic_utilities import IS_PYDANTIC_V2

    if IS_PYDANTIC_V2:
        return CppDocBlock(root=variant)  # type: ignore
    else:
        return CppDocBlock(__root__=variant)  # type: ignore


def text_seg(text: str) -> CppDocSegment:
    return CppDocSegment.factory.text(CppDocTextSegment(text=text))


def para_block(segments: list[CppDocSegment]) -> CppDocBlock:
    return CppDocBlock.factory.paragraph(CppParagraphBlock(segments=segments))


def image_block(value: CppImageBlock) -> CppDocBlock:
    """Construct CppDocBlock.image manually to work around SDK factory alias bug.

    The generated factory method CppDocBlock.factory.image() uses
    value.dict(exclude_unset=True) which returns Python field names (e.g. is_inline),
    but _CppDocBlock.Image expects the Pydantic alias (e.g. isInline) in v2 mode.
    """
    from src.generated.types.cpp_doc_block import _CppDocBlock
    img = _CppDocBlock.Image(
        path=value.path,
        caption=value.caption,
        is_inline=value.is_inline,
        type="image",
    )
    return _make_doc_block(img)


def code_block_doc_block(value: CppCodeBlock) -> CppDocBlock:
    """Construct CppDocBlock.code_block manually to work around SDK factory bug.

    The generated factory method CppDocBlock.factory.code_block() calls
    value.dict(exclude_unset=True) which includes the 'type' field from
    CppCodeBlock, then also passes type="codeBlock" as a keyword argument.
    This causes a TypeError due to duplicate 'type' keyword.
    """
    from src.generated.types.cpp_doc_block import _CppDocBlock
    cb = _CppDocBlock.CodeBlock(
        code=value.code,
        language=value.language,
        type="codeBlock",
    )
    return _make_doc_block(cb)


def bold_seg(text: str) -> CppDocSegment:
    return CppDocSegment.factory.bold(CppDocBoldSegment(text=text))


def emphasis_seg(text: str) -> CppDocSegment:
    return CppDocSegment.factory.emphasis(CppDocEmphasisSegment(text=text))


def link_seg(text: str, url: str) -> CppDocSegment:
    return CppDocSegment.factory.link(CppDocLinkSegment(text=text, url=url))


def ref_seg(text: str, refid: str, kindref: str) -> CppDocSegment:
    return CppDocSegment.factory.ref(CppDocRefSegment(text=text, refid=refid, kindref=kindref))


def code_seg(code: str) -> CppDocSegment:
    return CppDocSegment.factory.code(CppDocCodeSegment(code=code))


def code_ref_seg(code: str, refid: str, kindref: str) -> CppDocSegment:
    return CppDocSegment.factory.code_ref(CppDocCodeRefSegment(code=code, refid=refid, kindref=kindref))


def subscript_seg(text: str) -> CppDocSegment:
    return CppDocSegment.factory.subscript(CppDocSubscriptSegment(text=text))


def superscript_seg(text: str) -> CppDocSegment:
    return CppDocSegment.factory.superscript(CppDocSuperscriptSegment(text=text))
