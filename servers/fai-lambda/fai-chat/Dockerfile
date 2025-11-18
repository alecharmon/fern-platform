FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies
RUN dnf -y install git

# Install Poetry
RUN pip3 install poetry

# Copy dependency files
COPY fai-chat/pyproject.toml fai-chat/poetry.lock* ./

# Install Python dependencies
RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy shared utilities and application code
COPY shared/ ./shared/
COPY fai-chat/src/ ./src/

# Set the Lambda handler
CMD [ "src.handler.lambda_handler" ]
