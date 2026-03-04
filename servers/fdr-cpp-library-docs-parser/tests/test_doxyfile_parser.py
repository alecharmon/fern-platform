"""Tests for doxyfile_parser module."""

from pathlib import Path
from textwrap import dedent

import pytest

from src.doxyfile_parser import parse_doxyfile_aliases, find_doxyfile


@pytest.fixture
def doxyfile_content():
    """Real CUB-style ALIASES content."""
    return dedent('''\
        PROJECT_NAME           = CUB
        OUTPUT_DIRECTORY       = /tmp/output

        ALIASES = "rst=\\verbatim embed:rst:leading-asterisk"
        ALIASES += "endrst=\\endverbatim"
        ALIASES += "smemreuse=A subsequent ``__syncthreads()`` threadblock barrier should be invoked after calling this method if the collective's temporary storage (e.g., ``temp_storage``) is to be reused or repurposed."
        ALIASES += "smemwarpreuse=A subsequent ``__syncwarp()`` warp-wide barrier should be invoked after calling this method if the collective's temporary storage (e.g., ``temp_storage``) is to be reused or repurposed."
        ALIASES += "blockcollective{1}=Every thread in the block uses the \\1 class by first specializing the \\1 type, then instantiating an instance with parameters for communication, and finally invoking one or more collective member functions."
        ALIASES += "warpcollective{1}=Every thread in the warp uses the \\1 class by first specializing the \\1 type, then instantiating an instance with parameters for communication, and finally invoking or more collective member functions."
        ALIASES += "rowmajor=For multi-dimensional blocks, threads are linearly ranked in row-major order."
        ALIASES += "blocksize=The number of threads in the block is a multiple of the architecture's warp size"
        ALIASES += "devicestorage=When ``d_temp_storage`` is ``nullptr``, no work is done and the required allocation size is returned in ``temp_storage_bytes``. See :ref:`device-temp-storage` for usage guidance."
        ALIASES += "lookback=`decoupled look-back <https://research.nvidia.com/publication/single-pass-parallel-prefix-scan-decoupled-look-back>`_"

        PREDEFINED = __device__= \\
                     __host__=
    ''')


@pytest.fixture
def doxyfile_path(doxyfile_content, tmp_path):
    """Write doxyfile_content to a temp Doxyfile and return the path."""
    path = tmp_path / "Doxyfile"
    path.write_text(doxyfile_content)
    return path


def test_parse_simple_aliases(doxyfile_path):
    """Test parsing simple (non-parameterized) aliases."""
    aliases = parse_doxyfile_aliases(doxyfile_path)

    assert "rowmajor" in aliases
    assert aliases["rowmajor"] == "For multi-dimensional blocks, threads are linearly ranked in row-major order."

    assert "smemreuse" in aliases
    assert "``__syncthreads()``" in aliases["smemreuse"]

    assert "blocksize" in aliases
    assert "warp size" in aliases["blocksize"]


def test_parse_parameterized_alias(doxyfile_path):
    """Test parsing parameterized macros like @blockcollective{Name}."""
    aliases = parse_doxyfile_aliases(doxyfile_path)

    # Parameterized macros use "name{N}" as key
    assert "blockcollective{1}" in aliases
    assert "\\1" in aliases["blockcollective{1}"]
    assert "Every thread in the block uses the \\1 class" in aliases["blockcollective{1}"]


def test_parse_rst_alias(doxyfile_path):
    """Test that @rst/@endrst aliases are parsed."""
    aliases = parse_doxyfile_aliases(doxyfile_path)

    assert "rst" in aliases
    assert "endrst" in aliases


def test_parse_alias_with_url(doxyfile_path):
    """Test that aliases containing URLs are parsed correctly."""
    aliases = parse_doxyfile_aliases(doxyfile_path)

    assert "lookback" in aliases
    assert "research.nvidia.com" in aliases["lookback"]


def test_missing_doxyfile(tmp_path):
    """Test that missing Doxyfile returns empty dict."""
    aliases = parse_doxyfile_aliases(tmp_path / "nonexistent")
    assert aliases == {}


def test_find_doxyfile_root(tmp_path):
    """Test finding Doxyfile in repo root."""
    (tmp_path / "Doxyfile").write_text("# empty")
    assert find_doxyfile(tmp_path) == tmp_path / "Doxyfile"


def test_find_doxyfile_docs_dir(tmp_path):
    """Test finding Doxyfile in docs/ subdirectory."""
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "Doxyfile").write_text("# empty")
    assert find_doxyfile(tmp_path) == tmp_path / "docs" / "Doxyfile"


def test_find_doxyfile_not_found(tmp_path):
    """Test that find_doxyfile returns None when no Doxyfile exists."""
    assert find_doxyfile(tmp_path) is None
