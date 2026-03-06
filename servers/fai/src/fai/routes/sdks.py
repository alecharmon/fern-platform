from fastapi import (
    Body,
    Depends,
    HTTPException,
    status,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from fai.app import fai_app
from fai.dependencies import verify_org_token
from fai.models.api.sdks_api import (
    AnalyzeCommitDiffRequest,
    AnalyzeCommitDiffResponse,
)
from fai.settings import LOGGER
from fai.utils.generate_model import generate_anthropic_generic_async

# Maximum diff size in characters (roughly 100KB = ~25k-30k tokens for Claude)
MAX_DIFF_SIZE = 100_000

COMMIT_ANALYSIS_PROMPT = """You are an expert software engineer analyzing changes to generate semantic commit messages.

Analyze the provided git diff and return a structured response with these fields:
- message: A git commit message formatted like the example below
- version_bump: One of: MAJOR, MINOR, PATCH, or NO_CHANGE

Version Bump Guidelines:
- MAJOR: Breaking changes (removed/renamed functions, changed signatures, removed parameters)
- MINOR: New features that are backward compatible (new functions, new optional parameters)
- PATCH: Bug fixes, documentation, internal refactoring, or other changes that don't affect the public API
- NO_CHANGE: The diff is empty

--- Examples ---

Examples of correct classifications:

--- MAJOR: removed exported TypeScript function ---
diff --git a/src/api/client.ts b/src/api/client.ts
-export async function getUser(id: string): Promise<User> {{
-    return this.request("GET", `/users/${{id}}`);
-}}
version_bump: MAJOR
reason: Existing callers of getUser() will get a compile error.

--- MAJOR: removed Python public method ---
diff --git a/vital/client.py b/vital/client.py
-    def get_user(self, user_id: str) -> User:
-        return self._request("GET", f"/users/{{user_id}}")
version_bump: MAJOR
reason: Existing callers crash with AttributeError.

--- MINOR: new optional TypeScript parameter ---
diff --git a/src/api/client.ts b/src/api/client.ts
-async createUser(name: string): Promise<User>
+async createUser(name: string, role?: UserRole): Promise<User>
version_bump: MINOR
reason: Existing callers unaffected — new parameter is optional.

--- MINOR: new Java public method ---
diff --git a/src/.../UsersClient.java b/src/.../UsersClient.java
+    public CompletableFuture<User> getUserAsync(String userId) {{
+        return this.httpClient.sendAsync(...);
+    }}
version_bump: MINOR
reason: New capability added, nothing removed or changed.

--- PATCH: internal retry constant ---
diff --git a/src/core/http_client.py b/src/core/http_client.py
-MAX_RETRIES = 3
+MAX_RETRIES = 5
version_bump: PATCH
reason: Implementation detail — public API surface unchanged.

--- PATCH: Go import reorganization ---
diff --git a/client.go b/client.go
-import "fmt"
-import "net/http"
+import (
+    "fmt"
+    "net/http"
+)
version_bump: PATCH
reason: Formatting change only, no functional difference.

--- End Examples ---

Apply these patterns to the diff below. When in doubt between MINOR and PATCH,
prefer MINOR. When in doubt between MAJOR and MINOR, examine whether existing
callers would break without any code changes on their side.

Message Format (use this exact structure):
```
<type>: <short summary>

<detailed description of what changed and why it matters>

Key changes:
- <change 1>
- <change 2>
- <change 3>

🌿 Generated with Fern
```

Message Guidelines:
- Use conventional commit types: feat, fix, refactor, docs, chore, test, style, perf
- Keep the summary line under 72 characters
- Write in present tense imperative mood ("add" not "added" or "adds")
- For breaking changes: include migration instructions in the detailed description
- For new features: highlight new capabilities in the key changes
- For PATCH: describe the fix or improvement
- For NO_CHANGE: use type "chore" and state that no functional changes were made
- Be specific and action-oriented
- Always end with the "🌿 Generated with Fern" footer
- NEVER include the literal version "505.503.4455" in the commit message - if you see this placeholder
  in the diff, describe changes generically (e.g., "added X-Fern-SDK-Version header")

Git Diff:
{diff}"""


@fai_app.post(
    "/sdks/analyze-commit-diff",
    response_model=AnalyzeCommitDiffResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def analyze_commit_diff(
    body: AnalyzeCommitDiffRequest = Body(...),
    _token: str = Depends(verify_org_token),
) -> JSONResponse:
    """Analyzes a git diff and generates an AI-powered commit message with version bump recommendation."""
    # Validate diff size
    diff_size = len(body.diff)
    if diff_size > MAX_DIFF_SIZE:
        LOGGER.info(f"Diff too large: {diff_size} characters (max: {MAX_DIFF_SIZE})")
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Diff is too large ({diff_size} characters). Maximum allowed is {MAX_DIFF_SIZE} characters.",
        )

    try:
        result = await generate_anthropic_generic_async(
            response_type=AnalyzeCommitDiffResponse,
            prompt_template=COMMIT_ANALYSIS_PROMPT,
            model="claude-4-sonnet-20250514",
            diff=body.diff,
        )

        if result is None:
            LOGGER.error("Failed to analyze commit diff after retries")
            return JSONResponse(
                status_code=500,
                content={"detail": "Failed to analyze commit diff after multiple attempts"},
            )

        LOGGER.info(f"Successfully analyzed commit diff with version bump: {result.version_bump}")
        return JSONResponse(content=jsonable_encoder(result))

    except Exception as e:
        LOGGER.exception("Failed to analyze commit diff")
        return JSONResponse(status_code=500, content={"detail": str(e)})
