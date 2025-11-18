import logging

from mangum import Mangum

from .app import app

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Create Lambda handler using Mangum adapter
# This allows FastAPI to run on AWS Lambda
lambda_handler = Mangum(app, lifespan="off")
