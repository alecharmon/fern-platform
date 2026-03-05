FROM public.ecr.aws/lambda/python:3.12

# Install git (runtime dep) and build Doxygen 1.15.0 from source
# AL2023 dnf only has Doxygen 1.12.0; we need 1.15.0 for improved C++ support
RUN dnf install -y git cmake gcc-c++ make flex bison curl-minimal tar gzip && \
    curl -fsSL https://github.com/doxygen/doxygen/releases/download/Release_1_15_0/doxygen-1.15.0.src.tar.gz \
      -o /tmp/doxygen.tar.gz && \
    tar -xzf /tmp/doxygen.tar.gz -C /tmp && \
    cd /tmp/doxygen-1.15.0 && \
    mkdir build && cd build && \
    cmake -DCMAKE_INSTALL_PREFIX=/usr/local .. && \
    make -j$(nproc) && \
    make install && \
    cd / && rm -rf /tmp/doxygen* && \
    dnf clean all

RUN pip3 install poetry

COPY pyproject.toml poetry.lock* ./

RUN poetry config virtualenvs.create false && \
    poetry install --only main --no-root

WORKDIR ${LAMBDA_TASK_ROOT}
COPY src/ ./src/

CMD [ "src.handler.handler" ]
