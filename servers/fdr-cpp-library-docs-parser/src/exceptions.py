"""Exceptions for the C++ library docs parser."""


class CloneError(Exception):
    """Git clone operation failed."""


class ProjectDetectionError(Exception):
    """Could not detect a valid C++ project structure."""
