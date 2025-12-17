"""S3 client for uploading IR results."""

import json
import os

import boto3


def upload_ir_to_s3(bucket: str, key: str, ir: dict) -> None:
    """Upload IR JSON to S3."""
    # Support endpoint override for local development (LocalStack/S3 mock)
    endpoint_url = os.environ.get("AWS_ENDPOINT_URL")

    s3_client = boto3.client(
        "s3",
        endpoint_url=endpoint_url if endpoint_url else None,
    )

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(ir),
        ContentType="application/json",
    )
