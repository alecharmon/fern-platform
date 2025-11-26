# Use standard Python image instead of Lambda base image
# Lambda Web Adapter handles Lambda Runtime API communication
FROM public.ecr.aws/docker/library/python:3.12-slim

# Copy Lambda Web Adapter extension for response streaming support
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Install system dependencies
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip3 install poetry

# Set working directory (Lambda convention)
WORKDIR /var/task

# Copy dependency files
COPY fai-chat/pyproject.toml fai-chat/poetry.lock* ./

# Install Python dependencies
RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root

# Copy shared utilities and application code
COPY shared/ ./shared/
COPY fai-chat/src/ ./src/

# Ensure PYTHONPATH includes the working directory for module imports
ENV PYTHONPATH="/var/task:${PYTHONPATH}"

# Lambda Web Adapter runs uvicorn and proxies to Lambda runtime
CMD [ "python", "-m", "uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8080" ]
