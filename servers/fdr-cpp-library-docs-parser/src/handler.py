"""
Lambda handler for C++ library docs parsing.

Input (from FDR via AWS SDK invoke):
{
    "jobId": "libdocs_xxx",
    "githubUrl": "https://github.com/org/repo",
    "language": "CPP",
    "branch": "main",           # optional
    "packagePath": "src/pkg",   # optional
    "doxyfileContent": "..."    # optional — raw Doxyfile content
}

When ``doxyfileContent`` is provided, OUTPUT_DIRECTORY is automatically
appended so the parser always finds the generated XML in the expected
location.

Output:
Success: { "status": "success", "irS3Key": "library-docs-ir/libdocs_xxx.json" }
Error:   { "status": "error", "error": { "code": "...", "message": "..." } }
"""

import os
import traceback
from datetime import datetime, timezone
from typing import Any

from .doxyfile_parser import find_doxyfile, parse_doxyfile_aliases
from .exceptions import CloneError, DoxygenError, ProjectDetectionError, URLValidationError
from .git_clone import cleanup_repo, clone_repo
from .project_detector import detect_project
from .doxygen_runner import OUTPUT_DIR_NAME, run_doxygen
from .extractor import extract_library_docs
from .s3_client import upload_ir_to_s3
from .generated import IrMetadata


def handler(event: dict, context: Any) -> dict:
    """Lambda entry point."""
    repo_path = None

    try:
        # Validate input
        job_id = event.get("jobId")
        github_url = event.get("githubUrl")
        language = event.get("language", "CPP")
        branch = event.get("branch")
        package_path = event.get("packagePath")
        doxyfile_content = event.get("doxyfileContent")

        if not job_id or not github_url:
            return {
                "status": "error",
                "error": {
                    "code": "INVALID_INPUT",
                    "message": "jobId and githubUrl are required",
                },
            }

        if language != "CPP":
            return {
                "status": "error",
                "error": {
                    "code": "UNSUPPORTED_LANGUAGE",
                    "message": f"Language {language} is not supported. Only CPP is currently supported.",
                },
            }

        # 1. Clone repository
        try:
            repo_path = clone_repo(github_url, branch)
        except URLValidationError as e:
            return {
                "status": "error",
                "error": {
                    "code": "INVALID_URL",
                    "message": e.message,
                    "details": e.details,
                },
            }
        except CloneError as e:
            return {
                "status": "error",
                "error": {
                    "code": "CLONE_FAILED",
                    "message": e.message,
                    "details": e.details,
                },
            }

        # 2. Detect C++ project
        try:
            project_path = detect_project(repo_path, package_path)
        except ProjectDetectionError as e:
            return {
                "status": "error",
                "error": {
                    "code": "INVALID_PROJECT",
                    "message": e.message,
                    "details": e.details,
                },
            }

        # 3. Write inline Doxyfile if provided
        doxyfile_path = None
        if doxyfile_content:
            doxyfile_path = repo_path / "Doxyfile"
            if doxyfile_path.exists():
                print(f"Overwriting existing Doxyfile at {doxyfile_path}")
            # Ensure Doxygen writes output where the parser expects it
            output_dir = repo_path / OUTPUT_DIR_NAME
            output_dir.mkdir(parents=True, exist_ok=True)
            doxyfile_content += f"\nOUTPUT_DIRECTORY = {output_dir}\n"
            doxyfile_path.write_text(doxyfile_content)

        # 4. Run Doxygen
        try:
            xml_dir = run_doxygen(project_path, repo_path, doxyfile_path=doxyfile_path)
        except DoxygenError as e:
            return {
                "status": "error",
                "error": {
                    "code": "PARSE_FAILED",
                    "message": e.message,
                    "details": e.details,
                },
            }

        # 5. Extract Doxygen ALIASES from Doxyfile (if found)
        doxyfile = find_doxyfile(repo_path)
        aliases = parse_doxyfile_aliases(doxyfile) if doxyfile else {}

        # 6. Parse XML and build IR
        metadata = IrMetadata(
            package_name=package_path or "",
            language="CPP",
            source_url=github_url,
            branch=branch,
        )
        ir = extract_library_docs(xml_dir, metadata, aliases=aliases)

        # 7. Build result with IR and job metadata
        result = {
            "ir": ir.model_dump(mode="json", by_alias=True),
            "metadata": {
                "jobId": job_id,
                "sourceUrl": github_url,
                "branch": branch,
                "packagePath": package_path,
                "packageName": package_path,
                "parsedAt": datetime.now(timezone.utc).isoformat(),
                "parserVersion": "doxygen-extractor-1.0.0",
            },
        }

        # 8. Upload to S3
        bucket = os.environ.get("LIBRARY_DOCS_S3_BUCKET", "fdr")
        s3_key = f"library-docs-ir/{job_id}.json"

        upload_ir_to_s3(bucket, s3_key, result)

        return {"status": "success", "irS3Key": s3_key}

    except Exception as e:
        traceback.print_exc()

        return {
            "status": "error",
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(e),
            },
        }

    finally:
        if repo_path:
            cleanup_repo(repo_path)
