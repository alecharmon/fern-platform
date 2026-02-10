# Fern AI

Fern AI contains the core logic for our AI-powered services.

## Setup

```bash
curl -sSL https://install.python-poetry.org | python - -y --version 1.5.1
poetry install
```

## Development Commands

### Development Server

```bash
poetry run start                   # Run local FAI server
```

### Linting and Formatting

```bash
make code-cleanup                  # Run ruff formatter/linter
poetry run mypy .                  # Type checking
```

### Testing

```bash
poetry run pytest -sv              # Run with verbose output
```
