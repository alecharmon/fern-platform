.PHONY: install build run test

install:
	poetry install

build:
	docker build -t fdr-python-library-docs-parser .

run:
	docker run -p 9001:8080 \
		-e LIBRARY_DOCS_S3_BUCKET=fdr \
		-e AWS_ACCESS_KEY_ID=test \
		-e AWS_SECRET_ACCESS_KEY=test \
		fdr-python-library-docs-parser

test:
	poetry run pytest
