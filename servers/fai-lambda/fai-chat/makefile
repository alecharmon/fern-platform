code-format:
	poetry run black .
	poetry run isort .

code-cleanup:
	make code-format
	poetry run ruff check --fix src/ tests/
	poetry run ruff format src/ tests/

check:
	poetry run mypy .
	poetry run ruff check src/ tests/
	poetry run ruff format --check src/ tests/

test:
	poetry run pytest

.PHONY: code-format code-cleanup check test
