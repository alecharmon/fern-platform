"""
Lambda handler for C++ library docs parsing.

Input (from FDR via AWS SDK invoke):
{
    "jobId": "libdocs_xxx",
    "githubUrl": "https://github.com/org/repo",
    "language": "CPP",
    "branch": "main",        # optional
    "packagePath": "src/pkg" # optional
}

Output:
Success: { "status": "success", "irS3Key": "library-docs-ir/libdocs_xxx.json" }
Error:   { "status": "error", "error": { "code": "...", "message": "..." } }
"""

import traceback


def handler(event: dict, context) -> dict:
    """Lambda entry point."""
    try:
        # Validate input
        job_id = event.get("jobId")
        github_url = event.get("githubUrl")
        language = event.get("language", "CPP")

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

        s3_key = f"library-docs-ir/{job_id}.json"

        return {"status": "success", "irS3Key": s3_key}

    except Exception as e:
        traceback.print_exc()

        return {
            "status": "error",
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(e),
                "traceback": traceback.format_exc(),
            },
        }
