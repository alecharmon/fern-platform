"""Exceptions for the C++ library docs parser."""


class URLValidationError(Exception):
    """Git repository URL failed validation.

    Currently only GitHub and GitLab HTTPS URLs are supported.
    """

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class CloneError(Exception):
    """Git clone operation failed."""

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class ProjectDetectionError(Exception):
    """Could not detect a valid C++ project structure."""

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class DoxygenError(Exception):
    """Doxygen execution failed."""

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)
