# Overview
- `make code-cleanup`: Run the linter (no functional changes).
- `poetry run mypy .`: Run the MYPY typechecker.
- `poetry run pytest . -sv`: Run the tests.
- `poetry run start`: Start the application.

# Setup
- `export PYTHONPATH=$(pwd)` to add the project to your PYTHONPATH.
- `source .venv/bin/activate` to activate the virtual environment.

# Repository Structure
- `src/fai/`: The core application code.
- `src/fai/models/`: Database, API, and utility models.
- `src/fai/routes/`: The core application routes.
- `src/fai/utils/`: Utility functions.
- `tests/`: The test suite.
