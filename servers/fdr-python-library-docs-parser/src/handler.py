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

The result JSON contains a PythonLibraryDocsIR object which can be rendered
to MDX by FDR TypeScript.
"""

import os
import traceback
from datetime import datetime, timezone

from .git_clone import clone_repo, find_package_root, cleanup_repo, CloneError
from .parser import parse_package, ParseError
from .extractor import extract_python_ir
from .s3_client import upload_ir_to_s3


def handler(event: dict, context) -> dict:
    """Lambda entry point."""
    repo_path = None

    try:
        # Validate input
        job_id = event.get("jobId")
        github_url = event.get("githubUrl")
        language = event.get("language", "PYTHON")
        branch = event.get("branch")
        package_path = event.get("packagePath")

        if not job_id or not github_url:
            return {
                "status": "error",
                "error": {
                    "code": "INVALID_INPUT",
                    "message": "jobId and githubUrl are required",
                },
            }

        if language != "PYTHON":
            return {
                "status": "error",
                "error": {
                    "code": "UNSUPPORTED_LANGUAGE",
                    "message": f"Language {language} is not supported. Only PYTHON is currently supported.",
                },
            }

        # 1. Clone repository
        try:
            repo_path = clone_repo(github_url, branch)
        except CloneError as e:
            return {
                "status": "error",
                "error": {
                    "code": "CLONE_FAILED",
                    "message": e.message,
                    "details": e.details,
                },
            }

        # 2. Find Python package
        try:
            pkg_path = find_package_root(repo_path, package_path)
        except CloneError as e:
            return {
                "status": "error",
                "error": {
                    "code": "PACKAGE_NOT_FOUND",
                    "message": e.message,
                    "details": e.details,
                },
            }

        # 3. Parse with Griffe
        try:
            module = parse_package(pkg_path)
        except ParseError as e:
            return {
                "status": "error",
                "error": {
                    "code": "PARSE_FAILED",
                    "message": e.message,
                    "details": e.details,
                },
            }

        # 4. Extract IR (Griffe → PythonLibraryDocsIR)
        ir = extract_python_ir(
            griffe_module=module,
            source_url=github_url,
            branch=branch,
        )

        # 5. Build result with IR and job metadata
        result = {
            "ir": ir.model_dump(mode="json", by_alias=True),
            "metadata": {
                "jobId": job_id,
                "sourceUrl": github_url,
                "branch": branch,
                "packagePath": package_path,
                "packageName": module.name,
                "parsedAt": datetime.now(timezone.utc).isoformat(),
                "parserVersion": "griffe-extractor-1.0.0",
            },
        }

        # 6. Upload to S3
        bucket = os.environ.get("LIBRARY_DOCS_S3_BUCKET", "fdr")
        s3_key = f"library-docs-ir/{job_id}.json"

        upload_ir_to_s3(bucket, s3_key, result)

        return {"status": "success", "irS3Key": s3_key}

    except Exception as e:
        # Log full traceback for debugging
        traceback.print_exc()

        return {
            "status": "error",
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(e),
                "traceback": traceback.format_exc(),
            },
        }

    finally:
        # Clean up cloned repo
        if repo_path:
            cleanup_repo(repo_path)
