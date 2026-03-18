FROM python:3.13-slim-trixie

# Update OpenSSL packages to fix CVE-2025-15467 (Critical), CVE-2025-69420 (High), CVE-2025-69419 (High)
# Update GnuTLS to fix CVE-2025-14831 (Medium) - pinned from sid until trixie backport lands
# Update curl to fix CVE-2025-13034 (Medium) - QUIC certificate pinning bypass with GnuTLS
# Update dpkg to fix CVE-2026-2219 (High) - DoS via malformed zstd-compressed .deb archives
# Update expat to fix CVE-2026-32777 (High), CVE-2026-32776 (High)
RUN echo 'deb http://deb.debian.org/debian sid main' > /etc/apt/sources.list.d/sid.list && \
    printf 'Package: *\nPin: release a=unstable\nPin-Priority: 100\n' > /etc/apt/preferences.d/sid && \
    apt-get update && \
    apt-get upgrade -y libssl3t64 openssl && \
    apt-get install -y -t sid libgnutls30t64 curl libcurl4t64 libcurl3t64-gnutls dpkg libexpat1 && \
    apt-get install -y git && \
    rm -f /etc/apt/sources.list.d/sid.list /etc/apt/preferences.d/sid && \
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
