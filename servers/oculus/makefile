code-cleanup:
	poetry run black .
	poetry run ruff check --unsafe-fixes --fix src/ tests/
	poetry run ruff format src/ tests/

test:
	poetry run pytest -sv

typecheck:
	poetry run mypy src/
