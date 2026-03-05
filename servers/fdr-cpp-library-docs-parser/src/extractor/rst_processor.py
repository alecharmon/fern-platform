"""Parse RST verbatim blocks into CppDocstringIr structures via docutils."""

import logging
import re
import textwrap
from dataclasses import dataclass, field

import docutils.nodes
import docutils.parsers.rst
import docutils.parsers.rst.directives
import docutils.parsers.rst.roles
import docutils.utils
from docutils.frontend import get_default_settings

from src.extractor.ir_builders import (
    bold_seg,
    code_block_doc_block,
    code_seg,
    emphasis_seg,
    image_block,
    link_seg,
    para_block,
    ref_seg,
    subscript_seg,
    superscript_seg,
    text_seg,
)
from src.generated import (
    CppCodeBlock,
    CppDocBlock,
    CppDocSegment,
    CppImageBlock,
    CppListBlock,
    CppTitledSectionBlock,
)

logger = logging.getLogger(__name__)

_COMMENT_PREFIX_BANG = re.compile(r"^//!\s?")
_COMMENT_PREFIX_STAR = re.compile(r"^\s*\*\s?")


def _strip_comment_prefixes(lines: list[str]) -> list[str]:
    if not lines:
        return lines
    first = lines[0].lstrip()
    if first.startswith("//!"):
        return [_COMMENT_PREFIX_BANG.sub("", line) for line in lines]
    if first.startswith("*"):
        return [_COMMENT_PREFIX_STAR.sub("", line) for line in lines]
    return lines


# NOTE: Only supports single-argument macros (e.g. @alias{arg}).
# Multi-argument Doxygen ALIASES are not used by current corpora.
def _expand_aliases(text: str, aliases: dict[str, str]) -> str:
    def _replace(m: re.Match) -> str:
        name = m.group(1)
        arg = m.group(2)
        if arg is not None:
            param_key = f"{name}{{1}}"
            expansion = aliases.get(param_key)
            if expansion is not None:
                return expansion.replace("\\1", arg)
        plain = aliases.get(name)
        if plain is not None:
            return plain
        return m.group(0)

    return re.sub(r"@(\w+)(?:\{([^}]*)\})?", _replace, text)


def preprocess_rst_verbatim(content: str, aliases: dict[str, str]) -> str:
    lines = content.splitlines()
    # Strip embed:rst header line
    if lines and "embed:rst" in lines[0]:
        lines = lines[1:]
    lines = _strip_comment_prefixes(lines)
    text = "\n".join(lines)
    text = _expand_aliases(text, aliases)
    text = textwrap.dedent(text)
    return text


# ---------------------------------------------------------------------------
# docutils setup
# ---------------------------------------------------------------------------

class _VersionAddedNode(docutils.nodes.General, docutils.nodes.Element):
    pass


class _VersionAddedDirective(docutils.parsers.rst.Directive):
    required_arguments = 1
    optional_arguments = 99
    final_argument_whitespace = True
    has_content = True

    def run(self):
        node = _VersionAddedNode()
        node["version"] = self.arguments[0]
        return [node]


class _CodeBlockDirective(docutils.parsers.rst.Directive):
    required_arguments = 0
    optional_arguments = 1
    has_content = True
    option_spec = {
        "linenos": docutils.parsers.rst.directives.flag,
        "caption": docutils.parsers.rst.directives.unchanged,
    }

    def run(self):
        language = self.arguments[0] if self.arguments else None
        code = "\n".join(self.content)
        node = docutils.nodes.literal_block(code, code)
        if language:
            node["language"] = language
        return [node]


class _LiteralIncludeDirective(docutils.parsers.rst.Directive):
    required_arguments = 1
    optional_arguments = 0
    has_content = False
    option_spec = {
        "language": docutils.parsers.rst.directives.unchanged,
        "lines": docutils.parsers.rst.directives.unchanged,
        "start-after": docutils.parsers.rst.directives.unchanged,
        "end-before": docutils.parsers.rst.directives.unchanged,
    }

    def run(self):
        path = self.arguments[0]
        language = self.options.get("language")
        code = f"[literalinclude: {path}]"
        node = docutils.nodes.literal_block(code, code)
        if language:
            node["language"] = language
        return [node]


def _passthrough_role(role, rawtext, text, lineno, inliner, options=None, content=None):
    node = docutils.nodes.inline(rawtext, text)
    node["role"] = role
    return [node], []


_PASSTHROUGH_ROLES = [
    "ref", "cpp:class", "cpp:func", "cpp:enumerator", "cpp:struct",
    "sub", "sup", "math", "doc", "term", "any",
]


def _setup_docutils():
    docutils.parsers.rst.directives.register_directive("versionadded", _VersionAddedDirective)
    docutils.parsers.rst.directives.register_directive("code-block", _CodeBlockDirective)
    docutils.parsers.rst.directives.register_directive("literalinclude", _LiteralIncludeDirective)
    for role_name in _PASSTHROUGH_ROLES:
        docutils.parsers.rst.roles.register_canonical_role(role_name, _passthrough_role)


# ---------------------------------------------------------------------------
# Parse result
# ---------------------------------------------------------------------------

@dataclass
class RstParseResult:
    blocks: list[CppDocBlock] = field(default_factory=list)
    since_version: str | None = None
    warnings: list[list[CppDocSegment]] = field(default_factory=list)
    notes: list[list[CppDocSegment]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _inline_segments_from_node(node: docutils.nodes.Node) -> list[CppDocSegment]:
    segments: list[CppDocSegment] = []
    for child in node.children:
        segments.extend(_node_to_segments(child))
    return segments


def _node_to_segments(node: docutils.nodes.Node) -> list[CppDocSegment]:
    if isinstance(node, docutils.nodes.Text):
        return [text_seg(str(node))]
    if isinstance(node, docutils.nodes.literal):
        return [code_seg(node.astext())]
    if isinstance(node, docutils.nodes.reference):
        txt = node.astext()
        uri = node.get("refuri", "")
        if uri:
            return [link_seg(txt, uri)]
        refid = node.get("refid", "")
        return [ref_seg(txt, refid, "")]
    if isinstance(node, docutils.nodes.emphasis):
        return [emphasis_seg(node.astext())]
    if isinstance(node, docutils.nodes.strong):
        return [bold_seg(node.astext())]
    if isinstance(node, docutils.nodes.subscript):
        return [subscript_seg(node.astext())]
    if isinstance(node, docutils.nodes.superscript):
        return [superscript_seg(node.astext())]
    if isinstance(node, docutils.nodes.inline):
        role = node.get("role", "")
        txt = node.astext()
        if role == "sub":
            return [subscript_seg(txt)]
        if role == "sup":
            return [superscript_seg(txt)]
        if role in ("cpp:class", "cpp:func", "cpp:enumerator", "cpp:struct"):
            return [code_seg(txt)]
        if role in ("ref", "doc", "term", "any"):
            return [ref_seg(txt, "", "")]
        if role == "math":
            return [code_seg(txt)]
        return [text_seg(txt)]
    if isinstance(node, docutils.nodes.Element):
        return _inline_segments_from_node(node)
    return [text_seg(node.astext())] if node.astext() else []


# ---------------------------------------------------------------------------
# Node visitor
# ---------------------------------------------------------------------------

class IrNodeVisitor(docutils.nodes.GenericNodeVisitor):
    def __init__(self, document: docutils.nodes.document, result: RstParseResult):
        super().__init__(document)
        self.result = result

    def default_visit(self, node: docutils.nodes.Node) -> None:
        pass

    def default_departure(self, node: docutils.nodes.Node) -> None:
        pass

    def visit_paragraph(self, node: docutils.nodes.paragraph) -> None:
        if self._inside_admonition(node):
            raise docutils.nodes.SkipNode
        if self._parent_is(node, (docutils.nodes.list_item, docutils.nodes.section)):
            raise docutils.nodes.SkipNode
        segments = _inline_segments_from_node(node)
        if segments:
            self.result.blocks.append(para_block(segments))
        raise docutils.nodes.SkipNode

    def _visit_and_append_block(self, node: docutils.nodes.Node) -> None:
        self.result.blocks.extend(self._process_block_node(node))
        raise docutils.nodes.SkipNode

    def visit_literal_block(self, node: docutils.nodes.literal_block) -> None:
        self._visit_and_append_block(node)

    def visit_bullet_list(self, node: docutils.nodes.bullet_list) -> None:
        self._visit_and_append_block(node)

    def visit_enumerated_list(self, node: docutils.nodes.enumerated_list) -> None:
        self._visit_and_append_block(node)

    def visit_image(self, node: docutils.nodes.image) -> None:
        path = node.get("uri", "")
        caption = node.get("alt")
        ib = CppImageBlock(path=path, caption=caption, is_inline=False)
        self.result.blocks.append(image_block(ib))
        raise docutils.nodes.SkipNode

    def visit_section(self, node: docutils.nodes.section) -> None:
        title_node = node.children[0] if node.children and isinstance(node.children[0], docutils.nodes.title) else None
        title = title_node.astext() if title_node else None
        inner_blocks: list[CppDocBlock] = []
        start = 1 if title_node else 0
        for child in node.children[start:]:
            inner_blocks.extend(self._process_block_node(child))
        self.result.blocks.append(
            CppDocBlock.factory.titled_section(CppTitledSectionBlock(title=title, blocks=inner_blocks))
        )
        raise docutils.nodes.SkipNode

    def visit_note(self, node: docutils.nodes.note) -> None:
        segs = self._extract_admonition_segments(node)
        if segs:
            self.result.notes.append(segs)
        raise docutils.nodes.SkipNode

    def visit_warning(self, node: docutils.nodes.warning) -> None:
        segs = self._extract_admonition_segments(node)
        if segs:
            self.result.warnings.append(segs)
        raise docutils.nodes.SkipNode

    def _visit_versionadded(self, node: _VersionAddedNode) -> None:
        self.result.since_version = node.get("version")
        raise docutils.nodes.SkipNode

    def unknown_visit(self, node: docutils.nodes.Node) -> None:
        if isinstance(node, _VersionAddedNode):
            self._visit_versionadded(node)

    def unknown_departure(self, node: docutils.nodes.Node) -> None:
        pass

    def _inside_admonition(self, node: docutils.nodes.Node) -> bool:
        parent = node.parent
        while parent is not None:
            if isinstance(parent, (docutils.nodes.note, docutils.nodes.warning)):
                return True
            parent = getattr(parent, "parent", None)
        return False

    def _parent_is(self, node: docutils.nodes.Node, types: tuple) -> bool:
        parent = node.parent
        return parent is not None and isinstance(parent, types)

    def _extract_admonition_segments(self, node: docutils.nodes.Node) -> list[CppDocSegment]:
        # Only paragraphs are extracted because IR notes/warnings type is
        # list[list[CppDocSegment]] — each entry is a flat segment list, not blocks.
        segments: list[CppDocSegment] = []
        for child in node.children:
            if isinstance(child, docutils.nodes.paragraph):
                segments.extend(_inline_segments_from_node(child))
        return segments

    @staticmethod
    def _normalize_language(language: str | None) -> str | None:
        if language == "c++":
            return "cpp"
        return language

    def _process_block_node(self, node: docutils.nodes.Node) -> list[CppDocBlock]:
        if isinstance(node, docutils.nodes.paragraph):
            segs = _inline_segments_from_node(node)
            return [para_block(segs)] if segs else []
        if isinstance(node, docutils.nodes.literal_block):
            language = self._normalize_language(node.get("language"))
            code = node.astext()
            cb = CppCodeBlock(type="codeBlock", code=code, language=language)
            return [code_block_doc_block(cb)]
        if isinstance(node, docutils.nodes.bullet_list):
            return [CppDocBlock.factory.list_(self._parse_list_node(node, ordered=False))]
        if isinstance(node, docutils.nodes.enumerated_list):
            return [CppDocBlock.factory.list_(self._parse_list_node(node, ordered=True))]
        if isinstance(node, docutils.nodes.warning):
            segments = self._extract_admonition_segments(node)
            if segments:
                self.result.warnings.append(segments)
            return []
        if isinstance(node, docutils.nodes.note):
            segments = self._extract_admonition_segments(node)
            if segments:
                self.result.notes.append(segments)
            return []
        if isinstance(node, docutils.nodes.block_quote):
            return self._process_block_quote(node)
        return []

    def _process_block_quote(self, node: docutils.nodes.block_quote) -> list[CppDocBlock]:
        blocks: list[CppDocBlock] = []
        for child in node.children:
            blocks.extend(self._process_block_node(child))
        return blocks

    def _parse_list_node(self, node: docutils.nodes.Node, ordered: bool) -> CppListBlock:
        items: list[list[CppDocBlock]] = []
        for list_item in node.children:
            if not isinstance(list_item, docutils.nodes.list_item):
                continue
            item_blocks: list[CppDocBlock] = []
            for child in list_item.children:
                item_blocks.extend(self._process_block_node(child))
            items.append(item_blocks)
        return CppListBlock(ordered=ordered, items=items)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_rst_to_ir(rst_text: str) -> RstParseResult:
    parser = docutils.parsers.rst.Parser()
    settings = get_default_settings(docutils.parsers.rst.Parser)
    document = docutils.utils.new_document("<rst-verbatim>", settings)
    parser.parse(rst_text, document)
    result = RstParseResult()
    visitor = IrNodeVisitor(document, result)
    document.walkabout(visitor)
    return result


# Module-level setup is intentional: registers directives/roles once at import time.
# In Lambda, each container handles one invocation, so once-at-import is sufficient.
_setup_docutils()
