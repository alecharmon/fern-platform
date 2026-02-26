"""Tests for Doxygen runner."""

import shutil
import subprocess

import pytest
from lxml import etree
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.exceptions import DoxygenError
from src.doxygen_runner import run_doxygen, _generate_doxyfile, OUTPUT_DIR_NAME, DOXYGEN_TIMEOUT


class TestGenerateDoxyfile:
    """Tests for _generate_doxyfile()."""

    def _setup_paths(self, tmp_path, include_subdir: bool = False):
        """Create repo_path, optional include/ subdir, and output_dir. Returns (project_path, repo_path, output_dir)."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        if include_subdir:
            project_path = repo_path / "include"
            project_path.mkdir()
        else:
            project_path = repo_path
        output_dir = repo_path / OUTPUT_DIR_NAME
        output_dir.mkdir()
        return project_path, repo_path, output_dir

    def test_doxyfile_written_to_output_dir(self, tmp_path):
        """Doxyfile is created inside the output directory."""
        project_path, repo_path, output_dir = self._setup_paths(tmp_path, include_subdir=True)

        doxyfile_path = _generate_doxyfile(project_path, repo_path, output_dir)

        assert doxyfile_path == output_dir / "Doxyfile"
        assert doxyfile_path.exists()

    def test_doxyfile_contains_dynamic_values(self, tmp_path):
        """Doxyfile contains substituted repo_path, project_path, and output_dir."""
        project_path, repo_path, output_dir = self._setup_paths(tmp_path, include_subdir=True)

        doxyfile_path = _generate_doxyfile(project_path, repo_path, output_dir)
        content = doxyfile_path.read_text()

        assert f"STRIP_FROM_PATH        = {repo_path}" in content
        assert f"INPUT                  = {project_path}" in content
        assert f"OUTPUT_DIRECTORY       = {output_dir}" in content

    def test_doxyfile_contains_required_settings(self, tmp_path):
        """Doxyfile contains critical Doxygen settings."""
        project_path, repo_path, output_dir = self._setup_paths(tmp_path)

        doxyfile_path = _generate_doxyfile(project_path, repo_path, output_dir)
        content = doxyfile_path.read_text()

        assert "GENERATE_XML           = YES" in content
        assert "GENERATE_HTML          = NO" in content
        assert "XML_PROGRAMLISTING     = YES" in content
        assert "EXTRACT_ALL            = YES" in content
        assert "BUILTIN_STL_SUPPORT    = YES" in content
        assert "MACRO_EXPANSION        = YES" in content
        assert "JAVADOC_AUTOBRIEF      = YES" in content
        assert "INLINE_INHERITED_MEMB  = YES" in content
        assert "RECURSIVE              = YES" in content
        assert "HAVE_DOT               = NO" in content
        assert "EXTENSION_MAPPING      = cu=C++ cuh=C++" in content


class TestRunDoxygen:
    """Tests for run_doxygen()."""

    def _setup_successful_run(self, tmp_path, mock_run):
        """Create repo_path, configure mock for success, and create index.xml.

        Returns (repo_path, xml_dir) for further assertions.
        """
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_run.return_value = MagicMock(returncode=0)
        xml_dir = repo_path / OUTPUT_DIR_NAME / "xml"
        xml_dir.mkdir(parents=True)
        (xml_dir / "index.xml").write_text("<doxygenindex/>")
        return repo_path, xml_dir

    @patch("src.doxygen_runner.subprocess.run")
    def test_subprocess_called_with_correct_args(self, mock_run, tmp_path):
        """subprocess.run is called with correct doxygen command and cwd."""
        repo_path, _ = self._setup_successful_run(tmp_path, mock_run)

        run_doxygen(repo_path, repo_path)

        mock_run.assert_called_once()
        args, kwargs = mock_run.call_args
        assert args[0][0] == "doxygen"
        assert kwargs["cwd"] == str(repo_path)
        assert kwargs["capture_output"] is True
        assert kwargs["text"] is True
        assert kwargs["timeout"] == DOXYGEN_TIMEOUT

    @patch("src.doxygen_runner.subprocess.run")
    def test_returns_xml_directory(self, mock_run, tmp_path):
        """run_doxygen returns the path to the xml/ subdirectory."""
        repo_path, xml_dir = self._setup_successful_run(tmp_path, mock_run)

        result = run_doxygen(repo_path, repo_path)

        assert result == xml_dir

    @patch("src.doxygen_runner.subprocess.run")
    def test_nonzero_return_code_raises_doxygen_error(self, mock_run, tmp_path):
        """Non-zero return code raises DoxygenError with stderr in details."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        mock_run.return_value = MagicMock(returncode=1, stderr="some error")

        with pytest.raises(DoxygenError, match="exited with code 1") as exc_info:
            run_doxygen(repo_path, repo_path)

        assert exc_info.value.details["returncode"] == 1
        assert exc_info.value.details["stderr"] == "some error"

    @patch("src.doxygen_runner.subprocess.run")
    def test_missing_index_xml_raises_doxygen_error(self, mock_run, tmp_path):
        """Missing index.xml after successful run raises DoxygenError."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        mock_run.return_value = MagicMock(returncode=0)

        with pytest.raises(DoxygenError, match="index.xml was not generated"):
            run_doxygen(repo_path, repo_path)

    @patch("src.doxygen_runner.subprocess.run")
    def test_timeout_raises_doxygen_error(self, mock_run, tmp_path):
        """TimeoutExpired raises DoxygenError."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        mock_run.side_effect = subprocess.TimeoutExpired(cmd="doxygen", timeout=DOXYGEN_TIMEOUT)

        with pytest.raises(DoxygenError, match="timed out") as exc_info:
            run_doxygen(repo_path, repo_path)

        assert exc_info.value.details["timeout"] == DOXYGEN_TIMEOUT

    @patch("src.doxygen_runner.subprocess.run")
    def test_doxygen_not_installed_raises_doxygen_error(self, mock_run, tmp_path):
        """FileNotFoundError (doxygen not on PATH) raises DoxygenError."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        mock_run.side_effect = FileNotFoundError("No such file or directory: 'doxygen'")

        with pytest.raises(DoxygenError, match="not installed"):
            run_doxygen(repo_path, repo_path)

    @patch("src.doxygen_runner.subprocess.run")
    def test_doxyfile_written_before_subprocess(self, mock_run, tmp_path):
        """Doxyfile exists on disk when subprocess is invoked."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        def check_doxyfile_exists(*args, **kwargs):
            doxyfile = repo_path / OUTPUT_DIR_NAME / "Doxyfile"
            assert doxyfile.exists()
            return MagicMock(returncode=0)

        mock_run.side_effect = check_doxyfile_exists

        xml_dir = repo_path / OUTPUT_DIR_NAME / "xml"
        xml_dir.mkdir(parents=True)
        (xml_dir / "index.xml").write_text("<doxygenindex/>")

        run_doxygen(repo_path, repo_path)


@pytest.mark.skipif(shutil.which("doxygen") is None, reason="doxygen not installed")
class TestRunDoxygenIntegration:
    """Integration tests with real Doxygen."""

    def _create_cpp_fixture(self, path: Path) -> None:
        """Create minimal C++ fixture files."""
        path.mkdir(parents=True, exist_ok=True)

        (path / "example.h").write_text(
            "/// A sample class.\n"
            "class Example {\n"
            "public:\n"
            "    /// Do something.\n"
            "    void doSomething();\n"
            "};\n"
        )

        (path / "cuda_kernel.cu").write_text(
            "/// A CUDA kernel.\n"
            "__global__ void kernel() {}\n"
        )

        (path / "cuda_header.cuh").write_text(
            "/// A CUDA header function.\n"
            "__device__ void helper() {}\n"
        )

    def test_produces_index_xml(self, tmp_path):
        """Real Doxygen run produces index.xml."""
        repo_path = tmp_path / "repo"
        self._create_cpp_fixture(repo_path)

        xml_dir = run_doxygen(repo_path, repo_path)

        assert (xml_dir / "index.xml").exists()

    def test_xml_contains_compound_entries(self, tmp_path):
        """XML output contains <compound> entries from parsed code."""
        repo_path = tmp_path / "repo"
        self._create_cpp_fixture(repo_path)

        xml_dir = run_doxygen(repo_path, repo_path)

        tree = etree.parse(str(xml_dir / "index.xml"))
        compounds = tree.findall(".//compound")
        assert len(compounds) > 0, "Expected at least one <compound> element in index.xml"

    def test_cu_and_cuh_files_processed(self, tmp_path):
        """CUDA .cu and .cuh files are included in the Doxygen output."""
        repo_path = tmp_path / "repo"
        self._create_cpp_fixture(repo_path)

        xml_dir = run_doxygen(repo_path, repo_path)

        tree = etree.parse(str(xml_dir / "index.xml"))
        # Collect all compound and member names from the index
        all_names = {
            el.text
            for el in tree.iter("name")
            if el.text is not None
        }

        assert any(
            "cuda_kernel" in name or "kernel" in name for name in all_names
        ), f"Expected cuda_kernel or kernel in index names, got: {all_names}"
        assert any(
            "cuda_header" in name or "helper" in name for name in all_names
        ), f"Expected cuda_header or helper in index names, got: {all_names}"
