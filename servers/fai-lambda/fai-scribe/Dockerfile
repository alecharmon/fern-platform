FROM public.ecr.aws/lambda/python:3.12

RUN dnf -y install git tar nodejs npm

RUN curl -fsSL https://cli.github.com/packages/rpm/gh-cli.repo | tee /etc/yum.repos.d/gh-cli.repo && \
    dnf -y install gh

RUN npm install -g @anthropic-ai/claude-code

RUN pip3 install poetry

COPY fai-scribe/pyproject.toml fai-scribe/poetry.lock* ./

RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root

WORKDIR ${LAMBDA_TASK_ROOT}
COPY shared/ ./shared/
COPY fai-scribe/src/ ./src/

CMD [ "src.handler.handler" ]
