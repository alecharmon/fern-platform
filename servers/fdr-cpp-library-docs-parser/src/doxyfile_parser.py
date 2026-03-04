"""Parse Doxygen ALIASES from a Doxyfile."""

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# Matches: ALIASES += "name=expansion" or ALIASES = "name=expansion"
# Also handles parameterized macros: "name{1}=expansion with \1"
_ALIAS_LINE_RE = re.compile(
    r'^\s*ALIASES\s*\+?=\s*"([^"]+)"\s*$'
)

# Matches alias definition: name or name{N} followed by = and expansion
_ALIAS_DEF_RE = re.compile(
    r'^(\w+)(?:\{(\d+)\})?=(.*)'
)


def parse_doxyfile_aliases(doxyfile_path: Path) -> dict[str, str]:
    """Extract ALIASES from a Doxyfile.

    Parses lines like:
        ALIASES += "rowmajor=For multi-dimensional blocks..."
        ALIASES += "blockcollective{1}=Every thread in the block uses the \\1 class..."

    Args:
        doxyfile_path: Path to the Doxyfile.

    Returns:
        Dict mapping alias key to expansion text.
        No-arg macros use the bare name as key (e.g. "rowmajor").
        Parameterized macros use "name{N}" as key (e.g. "blockcollective{1}").
        The expansion text contains \\1, \\2, etc. placeholders for parameterized macros.
    """
    aliases: dict[str, str] = {}

    if not doxyfile_path.exists():
        logger.warning("Doxyfile not found: %s", doxyfile_path)
        return aliases

    try:
        text = doxyfile_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        logger.warning("Failed to read Doxyfile: %s", doxyfile_path, exc_info=True)
        return aliases

    for line in text.splitlines():
        m = _ALIAS_LINE_RE.match(line)
        if not m:
            continue
        alias_def = m.group(1)
        dm = _ALIAS_DEF_RE.match(alias_def)
        if not dm:
            continue
        name = dm.group(1)
        arity = dm.group(2)  # None for no-arg, "1" for {1}, etc.
        expansion = dm.group(3)
        if arity:
            key = f"{name}{{{arity}}}"
        else:
            key = name
        aliases[key] = expansion

    logger.info("Parsed %d aliases from %s", len(aliases), doxyfile_path)
    return aliases


def find_doxyfile(repo_path: Path) -> Path | None:
    """Search for a Doxyfile in common locations within a repository.

    Returns:
        Path to the Doxyfile if found, None otherwise.
    """
    candidates = [
        repo_path / "Doxyfile",
        repo_path / "docs" / "Doxyfile",
        repo_path / "doc" / "Doxyfile",
        repo_path / "Doxyfile.in",
        repo_path / "docs" / "Doxyfile.in",
    ]
    for candidate in candidates:
        if candidate.exists():
            logger.info("Found Doxyfile at %s", candidate)
            return candidate
    return None
