# Use standard Python image instead of Lambda base image
# Lambda Web Adapter handles Lambda Runtime API communication
FROM public.ecr.aws/docker/library/python:3.13-slim

# Copy Lambda Web Adapter extension for response streaming support
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Install system dependencies
# Update OpenSSL packages to fix CVE-2025-15467 (Critical), CVE-2025-69420 (High), CVE-2025-69419 (High)
RUN apt-get update && \
    apt-get upgrade -y libssl3t64 openssl && \
    apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip3 install --upgrade pip==26.0
RUN pip3 install poetry

# Set working directory (Lambda convention within repo layout)
WORKDIR /var/task/servers/fai-chat

# Copy dependency files
COPY servers/fai-chat/pyproject.toml servers/fai-chat/poetry.lock* ./
COPY servers/python-libs/fai_ai_core /var/task/servers/python-libs/fai_ai_core

# Install Python dependencies
RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root

# Copy application code
COPY servers/fai-chat/src/ ./src/

# Ensure PYTHONPATH includes the working directory for module imports
ENV PYTHONPATH="/var/task/servers/fai-chat:${PYTHONPATH:-}"

# Lambda Web Adapter runs uvicorn and proxies to Lambda runtime
CMD [ "python", "-m", "uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8080" ]
