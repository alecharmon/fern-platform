"""Tests for git clone operations."""

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from git.exc import GitCommandError

from src.exceptions import CloneError
from src.git_clone import clone_repo, cleanup_repo


class TestCloneRepo:
    """Tests for clone_repo()."""

    @patch("src.git_clone.Repo.clone_from")
    def test_clone_calls_clone_from_with_correct_args(self, mock_clone_from):
        """clone_repo passes correct arguments to Repo.clone_from."""
        repo_path = clone_repo("https://github.com/org/repo")
        try:
            mock_clone_from.assert_called_once()
            args, kwargs = mock_clone_from.call_args
            assert args[0] == "https://github.com/org/repo"
            assert kwargs["depth"] == 1
            assert kwargs["single_branch"] is True
            assert "branch" not in kwargs
        finally:
            cleanup_repo(repo_path)

    @patch("src.git_clone.Repo.clone_from")
    def test_clone_with_branch_passes_branch_kwarg(self, mock_clone_from):
        """clone_repo passes branch kwarg when specified."""
        repo_path = clone_repo("https://github.com/org/repo", branch="main")
        try:
            _, kwargs = mock_clone_from.call_args
            assert kwargs["branch"] == "main"
        finally:
            cleanup_repo(repo_path)

    @patch("src.git_clone.Repo.clone_from")
    def test_temp_dir_prefix(self, mock_clone_from):
        """Cloned directory uses the correct temp prefix."""
        repo_path = clone_repo("https://github.com/org/repo")
        try:
            assert "libdocs-cpp-" in repo_path.name
        finally:
            cleanup_repo(repo_path)

    @patch("src.git_clone.Repo.clone_from")
    def test_clone_failure_raises_clone_error(self, mock_clone_from):
        """GitCommandError is wrapped in CloneError."""
        mock_clone_from.side_effect = GitCommandError("clone", "fatal: repo not found")

        with pytest.raises(CloneError, match="Failed to clone"):
            clone_repo("https://github.com/org/nonexistent")

    @patch("src.git_clone.Repo.clone_from")
    @patch("src.git_clone.tempfile.mkdtemp")
    def test_clone_failure_cleans_up_temp_dir(self, mock_mkdtemp, mock_clone_from, tmp_path):
        """Temp directory is removed on clone failure."""
        known_dir = tmp_path / "libdocs-cpp-test"
        known_dir.mkdir()
        mock_mkdtemp.return_value = str(known_dir)
        mock_clone_from.side_effect = GitCommandError("clone", "fatal: repo not found")

        with pytest.raises(CloneError):
            clone_repo("https://github.com/org/nonexistent")

        assert not known_dir.exists()


class TestCleanupRepo:
    """Tests for cleanup_repo()."""

    def test_cleanup_removes_directory(self, tmp_path):
        """cleanup_repo removes the directory."""
        test_dir = tmp_path / "test-repo"
        test_dir.mkdir()
        (test_dir / "file.txt").write_text("content")

        cleanup_repo(test_dir)

        assert not test_dir.exists()

    def test_cleanup_nonexistent_dir_no_error(self, tmp_path):
        """cleanup_repo on nonexistent path does not raise."""
        nonexistent = tmp_path / "does-not-exist"
        cleanup_repo(nonexistent)
