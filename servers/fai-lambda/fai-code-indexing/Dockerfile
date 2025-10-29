FROM public.ecr.aws/lambda/python:3.12

WORKDIR ${LAMBDA_TASK_ROOT}
COPY src/ ./src/

CMD [ "src.handler.handler" ]
