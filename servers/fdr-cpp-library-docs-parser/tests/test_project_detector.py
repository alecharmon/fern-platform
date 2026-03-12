"""Tests for C++ project detection."""

import pytest

from src.exceptions import ProjectDetectionError
from src.project_detector import detect_project


class TestDetectProject:
    """Tests for detect_project()."""

    def test_happy_path(self, tmp_path):
        """Returns correct root Path."""
        root = detect_project(tmp_path)

        assert root == tmp_path

    def test_package_path_sets_root(self, tmp_path):
        """Explicit packagePath sets root to the subdirectory."""
        sub = tmp_path / "libs" / "core"
        sub.mkdir(parents=True)

        root = detect_project(tmp_path, package_path="libs/core")

        assert root == sub

    def test_invalid_package_path(self, tmp_path):
        """Non-existent packagePath raises ProjectDetectionError."""
        with pytest.raises(ProjectDetectionError) as exc_info:
            detect_project(tmp_path, package_path="nonexistent/path")

        assert "does not exist" in str(exc_info.value)

    def test_rejects_path_traversal_dotdot(self, tmp_path):
        """Package path with '..' is rejected."""
        with pytest.raises(ProjectDetectionError) as exc_info:
            detect_project(tmp_path, package_path="../etc/passwd")

        assert "path traversal" in str(exc_info.value)

    def test_rejects_absolute_package_path(self, tmp_path):
        """Absolute package path is rejected."""
        with pytest.raises(ProjectDetectionError) as exc_info:
            detect_project(tmp_path, package_path="/etc/passwd")

        assert "path traversal" in str(exc_info.value)

    def test_rejects_path_outside_repo(self, tmp_path):
        """Package path that resolves outside repo is rejected."""
        # Create a symlink that points outside the repo
        outside = tmp_path.parent / "outside"
        outside.mkdir(exist_ok=True)
        link = tmp_path / "escape"
        link.symlink_to(outside)

        with pytest.raises(ProjectDetectionError) as exc_info:
            detect_project(tmp_path, package_path="escape")

        assert "resolves outside repository" in str(exc_info.value)
