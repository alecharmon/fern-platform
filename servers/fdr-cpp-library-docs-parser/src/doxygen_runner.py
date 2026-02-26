"""Doxygen execution and XML output generation."""

import subprocess
from pathlib import Path

from src.doxyfile_template import render_doxyfile
from src.exceptions import DoxygenError

DOXYGEN_TIMEOUT = 300
OUTPUT_DIR_NAME = "_doxygen_output"


def _generate_doxyfile(project_path: Path, repo_path: Path, output_dir: Path) -> Path:
    """Write a Doxyfile and return its path."""
    doxyfile_path = output_dir / "Doxyfile"
    content = render_doxyfile(project_path, repo_path, output_dir)
    doxyfile_path.write_text(content)
    return doxyfile_path


def run_doxygen(project_path: Path, repo_path: Path) -> Path:
    """Run Doxygen on a C++ project and return the XML output path."""
    output_dir = repo_path / OUTPUT_DIR_NAME
    output_dir.mkdir(parents=True, exist_ok=True)

    doxyfile_path = _generate_doxyfile(project_path, repo_path, output_dir)

    try:
        result = subprocess.run(
            ["doxygen", str(doxyfile_path)],
            cwd=str(repo_path),
            capture_output=True,
            text=True,
            timeout=DOXYGEN_TIMEOUT,
        )
    except subprocess.TimeoutExpired as e:
        raise DoxygenError(
            f"Doxygen timed out after {DOXYGEN_TIMEOUT}s",
            {"timeout": DOXYGEN_TIMEOUT},
        ) from e
    except FileNotFoundError as e:
        raise DoxygenError(
            "doxygen is not installed or not found on PATH",
        ) from e

    if result.returncode != 0:
        raise DoxygenError(
            f"Doxygen exited with code {result.returncode}",
            {"returncode": result.returncode, "stderr": result.stderr},
        )

    xml_dir = output_dir / "xml"
    index_xml = xml_dir / "index.xml"
    if not index_xml.exists():
        raise DoxygenError(
            "Doxygen completed but index.xml was not generated",
            {"xml_dir": str(xml_dir)},
        )

    return xml_dir
