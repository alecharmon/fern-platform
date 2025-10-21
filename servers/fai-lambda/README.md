# FAI Scribe Lambda

A Python AWS Lambda function for FAI Scribe with EFS integration.

## Development

### Setup

```bash
# Install Poetry (if not already installed)
curl -sSL https://install.python-poetry.org | python - -y --version 1.5.1

# Install dependencies
poetry install
```

### Development Workflow

```bash
# Run tests
poetry run pytest -sv

# Lint code
poetry run ruff check .

# Format code
poetry run ruff format .

# Type check
poetry run mypy src
```

## Structure

- `src/handler.py` - Main Lambda handler
- `src/__init__.py` - Package initialization
- `pyproject.toml` - Poetry configuration and dependencies
- `requirements.txt` - Runtime dependencies (for Lambda)
- `.python-version` - Python version specification

## Features

- **Python 3.12** runtime
- **EFS Integration**: Mounts at `/mnt/efs` for persistent storage
- **Hello World endpoint**: Returns basic status and EFS mount information
- **Environment variables**:
  - `FERN_TOKEN` - Fern authentication token
  - `EFS_MOUNT_PATH` - EFS mount path (default: `/mnt/efs`)
  - `ENVIRONMENT_TYPE` - Deployment environment (dev2/prod)

## Deployment

The function is deployed via CDK in the `fai-lambda-deploy` package:

```bash
cd ../fai-lambda-deploy
pnpm deploy:dev   # Deploy to dev2
pnpm deploy:prod  # Deploy to prod
```

## Testing Locally

You can test the handler locally by creating a test event:

```python
from src.handler import handler

# Mock event and context
event = {
    "path": "/",
    "httpMethod": "GET"
}

class MockContext:
    request_id = "test-request-id"

response = handler(event, MockContext())
print(response)
```
