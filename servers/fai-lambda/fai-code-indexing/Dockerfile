FROM public.ecr.aws/lambda/python:3.12

RUN dnf -y install git tar nodejs npm

RUN curl -fsSL https://cli.github.com/packages/rpm/gh-cli.repo | tee /etc/yum.repos.d/gh-cli.repo && \
    dnf -y install gh

RUN npm install -g @anthropic-ai/claude-code

RUN pip3 install poetry

COPY fai-code-indexing/pyproject.toml fai-code-indexing/poetry.lock* ./

# Updated 2025-11-07: Added fern-fai-sdk dependency
RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root

WORKDIR ${LAMBDA_TASK_ROOT}
COPY shared/ ./shared/
COPY fai-code-indexing/src/ ./src/

CMD [ "src.handler.handler" ]
