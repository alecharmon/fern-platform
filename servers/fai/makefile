code-format:
	poetry run black .
	poetry run isort .

code-cleanup:
	make code-format
	poetry run ruff check --fix src/ tests/
	poetry run ruff format src/ tests/

check:
	poetry run python -m mypy .
	poetry run black --check .
	poetry run isort --check .

test:
	poetry run pytest

init-db:
	poetry run python -m src.utils.init_db

build-docker:
	docker build -t fai .

run-docker:
	docker run -p 8080:8080 fai
