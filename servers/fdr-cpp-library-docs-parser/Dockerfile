FROM public.ecr.aws/lambda/python:3.12

# Install doxygen and git for parsing C++ documentation and cloning repositories
RUN dnf install -y doxygen git && dnf clean all

RUN pip3 install poetry

COPY pyproject.toml poetry.lock* ./

RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root

WORKDIR ${LAMBDA_TASK_ROOT}
COPY src/ ./src/

CMD [ "src.handler.handler" ]
