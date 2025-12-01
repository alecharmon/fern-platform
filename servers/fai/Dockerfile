FROM python:3.13-slim-trixie

COPY pyproject.toml ./pyproject.toml
COPY poetry.lock ./poetry.lock
COPY ./src ./src
COPY ./logging.conf ./logging.conf
COPY ./.env ./.env

RUN pip3 install --upgrade pip==25.3
RUN pip3 install memray
RUN pip3 install uvicorn
RUN pip3 install poetry &&\
  poetry config virtualenvs.create false &&\
  poetry install

ENTRYPOINT ["poetry", "run", "start"]
