"""
Lambda handler for Python library docs parsing.

Input (from FDR via AWS SDK invoke):
{
    "jobId": "libdocs_xxx",
    "githubUrl": "https://github.com/org/repo",
    "language": "PYTHON",
    "branch": "main",        # optional
    "packagePath": "src/pkg" # optional
}

Output:
Success: { "status": "success", "irS3Key": "library-docs-ir/libdocs_xxx.json" }
Error:   { "status": "error", "error": { "code": "...", "message": "..." } }
"""

import json
import os
from datetime import datetime, timezone

from .s3_client import upload_ir_to_s3


def handler(event: dict, context) -> dict:
    """Lambda entry point."""
    try:
        job_id = event.get("jobId")
        github_url = event.get("githubUrl")
        language = event.get("language", "PYTHON")

        if not job_id or not github_url:
            return {
                "status": "error",
                "error": {
                    "code": "INVALID_INPUT",
                    "message": "jobId and githubUrl are required",
                },
            }

        # Generate stub IR (will be replaced with real griffe parsing later)
        ir = generate_stub_ir(github_url, language)

        # Upload IR to S3
        bucket = os.environ.get("LIBRARY_DOCS_S3_BUCKET", "fdr")
        s3_key = f"library-docs-ir/{job_id}.json"

        upload_ir_to_s3(bucket, s3_key, ir)

        return {"status": "success", "irS3Key": s3_key}

    except Exception as e:
        return {
            "status": "error",
            "error": {"code": "INTERNAL_ERROR", "message": str(e)},
        }


def generate_stub_ir(github_url: str, language: str) -> dict:
    """Generate stub IR for testing infrastructure."""
    # Extract repo name from URL for the library name
    repo_name = github_url.rstrip("/").split("/")[-1]

    return {
        "name": repo_name,
        "language": language,
        "modules": [
            {
                "name": repo_name,
                "docstring": f"Main module for {repo_name}",
                "members": [
                    {
                        "name": "ExampleClass",
                        "kind": "class",
                        "docstring": "An example class from the library.",
                        "members": [
                            {
                                "name": "__init__",
                                "kind": "function",
                                "docstring": "Initialize the example class.",
                            },
                            {
                                "name": "example_method",
                                "kind": "function",
                                "docstring": "An example method.",
                            },
                        ],
                    },
                    {
                        "name": "example_function",
                        "kind": "function",
                        "docstring": "An example function from the library.",
                    },
                    {
                        "name": "EXAMPLE_CONSTANT",
                        "kind": "constant",
                        "docstring": "An example constant.",
                    },
                ],
            }
        ],
        "metadata": {
            "sourceUrl": github_url,
            "parsedAt": datetime.now(timezone.utc).isoformat(),
            "parserVersion": "0.1.0-stub",
        },
    }
