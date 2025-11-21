from dataclasses import dataclass


@dataclass
class AuthUser:
    name: str | None = None
    email: str | None = None
    roles: list[str] | None = None


@dataclass
class AuthState:
    authenticated: bool
    user: AuthUser | None = None
    error: str | None = None
