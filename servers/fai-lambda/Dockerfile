FROM public.ecr.aws/lambda/python:3.12

RUN dnf -y install git tar

RUN curl -fsSL https://cli.github.com/packages/rpm/gh-cli.repo | tee /etc/yum.repos.d/gh-cli.repo && \
    dnf -y install gh

COPY requirements.txt .
RUN pip3 install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

WORKDIR ${LAMBDA_TASK_ROOT}
COPY src/*.py .

CMD [ "handler.handler" ]
