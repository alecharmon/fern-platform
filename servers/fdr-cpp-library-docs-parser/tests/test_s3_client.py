"""Tests for S3 client."""

import json
import os

import boto3
import pytest
from moto import mock_aws

from src.s3_client import upload_ir_to_s3

BUCKET = "test-bucket"
KEY = "library-docs-ir/test-job.json"


@mock_aws
class TestUploadIrToS3:
    """Tests for upload_ir_to_s3 using moto."""

    def _create_bucket(self):
        """Create the test S3 bucket."""
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=BUCKET)
        return s3

    def test_upload_stores_valid_json(self):
        """Uploaded object is valid JSON matching the input dict."""
        s3 = self._create_bucket()

        ir_data = {"ir": {"rootNamespace": {}}, "metadata": {"jobId": "test"}}
        upload_ir_to_s3(BUCKET, KEY, ir_data)

        response = s3.get_object(Bucket=BUCKET, Key=KEY)
        body = json.loads(response["Body"].read().decode("utf-8"))
        assert body == ir_data

    def test_upload_sets_content_type(self):
        """Uploaded object has application/json content type."""
        s3 = self._create_bucket()

        upload_ir_to_s3(BUCKET, KEY, {"test": True})

        response = s3.get_object(Bucket=BUCKET, Key=KEY)
        assert response["ContentType"] == "application/json"

    def test_upload_overwrites_existing_object(self):
        """Uploading to same key overwrites the previous content."""
        s3 = self._create_bucket()

        upload_ir_to_s3(BUCKET, KEY, {"version": 1})
        upload_ir_to_s3(BUCKET, KEY, {"version": 2})

        response = s3.get_object(Bucket=BUCKET, Key=KEY)
        body = json.loads(response["Body"].read().decode("utf-8"))
        assert body["version"] == 2
