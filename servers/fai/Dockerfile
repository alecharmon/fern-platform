FROM python:3.13-slim-trixie

# Update OpenSSL packages to fix CVE-2025-15467 (Critical), CVE-2025-69420 (High), CVE-2025-69419 (High)
RUN apt-get update && \
    apt-get upgrade -y libssl3t64 openssl && \
    apt-get install -y git curl && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --upgrade pip==26.0
RUN pip3 install memray
RUN pip3 install uvicorn
RUN pip3 install poetry

WORKDIR /app/servers/fai

COPY fai/pyproject.toml fai/poetry.lock* ./
COPY python-libs/fai_ai_core /app/servers/python-libs/fai_ai_core

RUN poetry config virtualenvs.create false && \
    poetry install --no-root

COPY fai/src/ ./src/
COPY fai/logging.conf ./logging.conf
COPY fai/.env ./.env

ENV PYTHONPATH="/app/servers/fai/src:${PYTHONPATH:-}"

ENTRYPOINT ["poetry", "run", "start"]
