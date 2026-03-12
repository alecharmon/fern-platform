"""Integration tests for the C++ library docs Lambda handler."""

import json
import shutil

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.exceptions import CloneError, DoxygenError, ProjectDetectionError, URLValidationError
from src.handler import handler


class TestHandlerMocked:
    """Mocked orchestration tests — always run, mock git_clone/doxygen/S3."""

    @patch("src.handler.upload_ir_to_s3")
    @patch("src.handler.extract_library_docs")
    @patch("src.handler.run_doxygen")
    @patch("src.handler.detect_project")
    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_full_pipeline_success(
        self,
        mock_clone,
        mock_cleanup,
        mock_detect,
        mock_doxygen,
        mock_extract,
        mock_upload,
        tmp_path,
    ):
        """Full pipeline with mocked dependencies returns success with irS3Key."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_clone.return_value = repo_path
        mock_detect.return_value = repo_path
        mock_doxygen.return_value = repo_path / "xml"

        mock_ir = MagicMock()
        mock_ir.model_dump.return_value = {"metadata": {}, "rootNamespace": {}, "groups": []}
        mock_extract.return_value = mock_ir

        event = {
            "jobId": "test-job-123",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
            "branch": "main",
            "packagePath": "src/pkg",
        }

        result = handler(event, None)

        assert result["status"] == "success"
        assert result["irS3Key"] == "library-docs-ir/test-job-123.json"
        mock_clone.assert_called_once_with("https://github.com/org/repo", "main")
        mock_detect.assert_called_once_with(repo_path, "src/pkg")
        mock_doxygen.assert_called_once()
        mock_extract.assert_called_once()
        mock_upload.assert_called_once()
        mock_ir.model_dump.assert_called_once_with(mode="json", by_alias=True)

    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_invalid_url_returns_invalid_url_error(self, mock_clone, mock_cleanup):
        """URLValidationError returns INVALID_URL error response."""
        mock_clone.side_effect = URLValidationError(
            "githubUrl must match https://github.com/<owner>/<repo>",
            {"url": "file:///etc/passwd"},
        )

        event = {
            "jobId": "test-job",
            "githubUrl": "file:///etc/passwd",
            "language": "CPP",
        }

        result = handler(event, None)

        assert result["status"] == "error"
        assert result["error"]["code"] == "INVALID_URL"
        assert "github.com" in result["error"]["message"]

    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_clone_error_returns_clone_failed(self, mock_clone, mock_cleanup):
        """CloneError returns CLONE_FAILED error response."""
        mock_clone.side_effect = CloneError("repo not found", {"stderr": "fatal"})

        event = {
            "jobId": "test-job",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
        }

        result = handler(event, None)

        assert result["status"] == "error"
        assert result["error"]["code"] == "CLONE_FAILED"
        assert "repo not found" in result["error"]["message"]
        assert result["error"]["details"]["stderr"] == "fatal"

    @patch("src.handler.detect_project")
    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_project_detection_error_returns_invalid_project(
        self, mock_clone, mock_cleanup, mock_detect, tmp_path
    ):
        """ProjectDetectionError returns INVALID_PROJECT error response."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_clone.return_value = repo_path
        mock_detect.side_effect = ProjectDetectionError(
            "path does not exist", {"package_path": "bad/path"}
        )

        event = {
            "jobId": "test-job",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
            "packagePath": "bad/path",
        }

        result = handler(event, None)

        assert result["status"] == "error"
        assert result["error"]["code"] == "INVALID_PROJECT"
        assert "path does not exist" in result["error"]["message"]

    @patch("src.handler.run_doxygen")
    @patch("src.handler.detect_project")
    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_doxygen_error_returns_parse_failed(
        self, mock_clone, mock_cleanup, mock_detect, mock_doxygen, tmp_path
    ):
        """DoxygenError returns PARSE_FAILED error response."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_clone.return_value = repo_path
        mock_detect.return_value = repo_path
        mock_doxygen.side_effect = DoxygenError(
            "doxygen exited with code 1", {"returncode": 1}
        )

        event = {
            "jobId": "test-job",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
        }

        result = handler(event, None)

        assert result["status"] == "error"
        assert result["error"]["code"] == "PARSE_FAILED"
        assert "exited with code 1" in result["error"]["message"]

    @patch("src.handler.run_doxygen")
    @patch("src.handler.detect_project")
    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_generic_exception_returns_internal_error(
        self, mock_clone, mock_cleanup, mock_detect, mock_doxygen, tmp_path
    ):
        """Generic exception returns INTERNAL_ERROR without traceback in response."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_clone.return_value = repo_path
        mock_detect.return_value = repo_path
        mock_doxygen.side_effect = RuntimeError("unexpected failure")

        event = {
            "jobId": "test-job",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
        }

        result = handler(event, None)

        assert result["status"] == "error"
        assert result["error"]["code"] == "INTERNAL_ERROR"
        assert "unexpected failure" in result["error"]["message"]
        assert "traceback" not in result["error"]

    @patch("src.handler.upload_ir_to_s3")
    @patch("src.handler.extract_library_docs")
    @patch("src.handler.run_doxygen")
    @patch("src.handler.detect_project")
    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_cleanup_called_on_success(
        self,
        mock_clone,
        mock_cleanup,
        mock_detect,
        mock_doxygen,
        mock_extract,
        mock_upload,
        tmp_path,
    ):
        """Repo dir is cleaned up after successful pipeline."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_clone.return_value = repo_path
        mock_detect.return_value = repo_path
        mock_doxygen.return_value = repo_path / "xml"

        mock_ir = MagicMock()
        mock_ir.model_dump.return_value = {}
        mock_extract.return_value = mock_ir

        event = {
            "jobId": "test-job",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
        }

        handler(event, None)

        mock_cleanup.assert_called_once_with(repo_path)

    @patch("src.handler.run_doxygen")
    @patch("src.handler.detect_project")
    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_cleanup_called_on_failure(
        self, mock_clone, mock_cleanup, mock_detect, mock_doxygen, tmp_path
    ):
        """Repo dir is cleaned up even when pipeline fails."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_clone.return_value = repo_path
        mock_detect.return_value = repo_path
        mock_doxygen.side_effect = RuntimeError("boom")

        event = {
            "jobId": "test-job",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
        }

        handler(event, None)

        mock_cleanup.assert_called_once_with(repo_path)

    @patch("src.handler.upload_ir_to_s3")
    @patch("src.handler.extract_library_docs")
    @patch("src.handler.run_doxygen")
    @patch("src.handler.detect_project")
    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_doxyfile_content_written_and_passed_to_doxygen(
        self,
        mock_clone,
        mock_cleanup,
        mock_detect,
        mock_doxygen,
        mock_extract,
        mock_upload,
        tmp_path,
    ):
        """doxyfileContent is written to disk and passed to run_doxygen."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_clone.return_value = repo_path
        mock_detect.return_value = repo_path
        mock_doxygen.return_value = repo_path / "xml"

        mock_ir = MagicMock()
        mock_ir.model_dump.return_value = {"metadata": {}, "rootNamespace": {}, "groups": []}
        mock_extract.return_value = mock_ir

        event = {
            "jobId": "test-job-doxyfile",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
            "doxyfileContent": "INPUT = /src\nGENERATE_XML = YES\n",
        }

        result = handler(event, None)

        assert result["status"] == "success"
        doxyfile_path = repo_path / "Doxyfile"
        assert doxyfile_path.exists()
        written = doxyfile_path.read_text()
        assert "INPUT = /src" in written
        assert "GENERATE_XML = YES" in written
        # OUTPUT_DIRECTORY is appended automatically by the handler
        assert "OUTPUT_DIRECTORY" in written
        mock_doxygen.assert_called_once_with(repo_path, repo_path, doxyfile_path=doxyfile_path)


    @patch("src.handler.upload_ir_to_s3")
    @patch("src.handler.extract_library_docs")
    @patch("src.handler.run_doxygen")
    @patch("src.handler.detect_project")
    @patch("src.handler.cleanup_repo")
    @patch("src.handler.clone_repo")
    def test_inline_doxyfile_aliases_extracted(
        self,
        mock_clone,
        mock_cleanup,
        mock_detect,
        mock_doxygen,
        mock_extract,
        mock_upload,
        tmp_path,
    ):
        """Aliases in doxyfileContent are parsed and passed to extract_library_docs."""
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        mock_clone.return_value = repo_path
        mock_detect.return_value = repo_path
        mock_doxygen.return_value = repo_path / "xml"

        mock_ir = MagicMock()
        mock_ir.model_dump.return_value = {"metadata": {}, "rootNamespace": {}, "groups": []}
        mock_extract.return_value = mock_ir

        event = {
            "jobId": "test-alias-job",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
            "doxyfileContent": 'ALIASES += "myalias=replacement"\n',
        }

        result = handler(event, None)

        assert result["status"] == "success"
        mock_extract.assert_called_once()
        call_kwargs = mock_extract.call_args
        aliases = call_kwargs.kwargs.get("aliases") or call_kwargs[1].get("aliases")
        assert aliases is not None, "aliases kwarg was not passed to extract_library_docs"
        assert "myalias" in aliases
        assert aliases["myalias"] == "replacement"


@pytest.mark.skipif(shutil.which("doxygen") is None, reason="doxygen not installed")
class TestHandlerRealDoxygen:
    """Real Doxygen tests — skip if Doxygen not installed."""

    def _create_cpp_fixture(self, path: Path) -> None:
        """Create a small C++ project fixture."""
        path.mkdir(parents=True, exist_ok=True)

        (path / "example.h").write_text(
            "/// @brief A sample namespace.\n"
            "namespace example {\n"
            "\n"
            "/// A sample class.\n"
            "class Widget {\n"
            "public:\n"
            "    /// Do something useful.\n"
            "    /// @param count Number of times to do it.\n"
            "    void doSomething(int count);\n"
            "};\n"
            "\n"
            "/// A free function.\n"
            "/// @return The answer.\n"
            "int getAnswer();\n"
            "\n"
            "} // namespace example\n"
        )

    @patch("src.handler.upload_ir_to_s3")
    @patch("src.handler.clone_repo")
    @patch("src.handler.cleanup_repo")
    def test_real_doxygen_pipeline(self, mock_cleanup, mock_clone, mock_upload, tmp_path):
        """Run full pipeline with real Doxygen and mocked S3/clone."""
        repo_path = tmp_path / "repo"
        self._create_cpp_fixture(repo_path)
        mock_clone.return_value = repo_path

        event = {
            "jobId": "real-doxygen-test",
            "githubUrl": "https://github.com/org/repo",
            "language": "CPP",
        }

        result = handler(event, None)

        assert result["status"] == "success"
        assert result["irS3Key"] == "library-docs-ir/real-doxygen-test.json"

        mock_upload.assert_called_once()
        upload_args = mock_upload.call_args
        payload = upload_args[0][2]

        ir = payload["ir"]
        assert "rootNamespace" in ir
        assert "groups" in ir
        assert "metadata" in ir

        root_ns = ir["rootNamespace"]
        namespaces = root_ns.get("namespaces", [])

        ns_names = [ns["name"] for ns in namespaces]
        assert "example" in ns_names

        example_ns = next(ns for ns in namespaces if ns["name"] == "example")

        class_names = [c["name"] for c in example_ns.get("classes", [])]
        assert "Widget" in class_names

        fn_names = [f["name"] for f in example_ns.get("functions", [])]
        assert "getAnswer" in fn_names
