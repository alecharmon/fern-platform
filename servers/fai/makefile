code-cleanup:
	poetry run ruff check --unsafe-fixes --fix src/ tests/
	poetry run ruff format src/ tests/

check:
	poetry run python -m mypy .
	poetry run ruff check src/ tests/

test:
	poetry run pytest

init-db:
	poetry run python -m src.utils.init_db

build-docker:
	docker build -t fai .

run-docker:
	docker run -p 8080:8080 fai
