FROM public.ecr.aws/lambda/python:3.12

RUN pip3 install poetry

COPY pyproject.toml poetry.lock* ./

RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root

WORKDIR ${LAMBDA_TASK_ROOT}
COPY src/ ./src/

CMD [ "src.handler.handler" ]
