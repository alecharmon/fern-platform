# Python Library Docs Parser

Lambda for parsing Python library documentation and generating IR (Intermediate Representation).

## Development

### Install dependencies
```bash
poetry install
```

### Run tests
```bash
poetry run pytest -sv
```

### Linting and formatting
```bash
poetry run ruff check .
poetry run ruff format .
poetry run mypy .
```

## Adding Dependencies

When adding or updating dependencies in `pyproject.toml`, you must regenerate the lock file:

```bash
# Add a new dependency
poetry add <package>

# Add a dev dependency
poetry add --group dev <package>

# After manual edits to pyproject.toml, regenerate lock file
poetry lock
```

**Important**: Always commit `poetry.lock` alongside `pyproject.toml` changes. The Docker build requires the lock file to be in sync.
