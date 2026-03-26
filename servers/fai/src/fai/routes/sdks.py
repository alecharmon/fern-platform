from __future__ import annotations

import json
from pathlib import Path

from fastapi import (
    Body,
    Depends,
    HTTPException,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from fai.app import fai_app
from fai.dependencies import verify_org_token
from fai.models.api.sdks_api import (
    AnalyzeCommitDiffRequest,
    AnalyzeCommitDiffResponse,
    ConsolidateChangelogRequest,
    ConsolidateChangelogResponse,
    VersionBump,
)
from fai.settings import LOGGER
from fai.utils.diff_chunking import (
    MAX_AI_DIFF_BYTES,
    MAX_CHUNKS,
    MAX_RAW_DIFF_BYTES,
    chunk_diff,
    max_version_bump,
)
from fai.utils.generate_model import generate_anthropic_generic_async

_RULES_FILE = Path(__file__).resolve().parent.parent / "data" / "language_rules.json"


def _load_language_rules() -> tuple[dict[str, str], str]:
    """Load language-specific breaking change rules from shared JSON data file."""
    with open(_RULES_FILE) as f:
        data = json.load(f)
    return data["languages"], data["generic_template"]


LANGUAGE_RULES, GENERIC_LANGUAGE_RULES = _load_language_rules()


def _build_prompt(
    diff: str,
    language: str | None = None,
    previous_version: str | None = None,
    prior_changelog: str | None = None,
    spec_commit_message: str | None = None,
) -> str:
    sections: list[str] = []

    sections.append(
        "You are an expert software engineer analyzing changes to generate semantic commit messages.\n\n"
        "Analyze the provided git diff and return a structured response with these fields:\n"
        "- message: A git commit message formatted like the example below\n"
        "- changelog_entry: A user-facing release note for CHANGELOG.md and GitHub Releases\n"
        "- version_bump: One of: MAJOR, MINOR, PATCH, or NO_CHANGE\n"
        "- version_bump_reason: One sentence explaining WHY this version bump was chosen"
    )

    guidelines = (
        "\n\nVersion Bump Guidelines:\n"
        "- MAJOR: Breaking changes (removed/renamed functions, changed signatures, removed parameters)\n"
        "- MINOR: New features that are backward compatible (new functions, new optional parameters)."
    )
    if language:
        guidelines += (
            "\n  Also MINOR: behavioral changes invisible to the public API surface that still affect consumers:\n"
            "  - Changed HTTP status code handling (e.g. 404 now throws instead of returning null)\n"
            "  - Changed default parameter values (timeout, retry count, page size, base URL)\n"
            "  - Changed serialization behavior (date formats, null handling, field ordering)\n"
            "  - Changed error message text that consumers may depend on\n"
            "  - Changed HTTP header names or values sent to the server\n"
            "  - Changed retry or backoff behavior (different retry counts, delay strategies)"
        )
    guidelines += (
        "\n- PATCH: Bug fixes, documentation, internal refactoring with no observable behavioral change\n"
        "- NO_CHANGE: The diff is empty"
    )
    sections.append(guidelines)

    sections.append(
        "\n\n--- Examples ---\n\n"
        "Examples of correct classifications:\n\n"
        "--- MAJOR: removed exported TypeScript function ---\n"
        "diff --git a/src/api/client.ts b/src/api/client.ts\n"
        "-export async function getUser(id: string): Promise<User> {\n"
        '-    return this.request("GET", `/users/${id}`);\n'
        "-}\n"
        "version_bump: MAJOR\n"
        "reason: Existing callers of getUser() will get a compile error.\n\n"
        "--- MAJOR: removed Python public method ---\n"
        "diff --git a/vital/client.py b/vital/client.py\n"
        "-    def get_user(self, user_id: str) -> User:\n"
        '-        return self._request("GET", f"/users/{user_id}")\n'
        "version_bump: MAJOR\n"
        "reason: Existing callers crash with AttributeError.\n\n"
        "--- MINOR: new optional TypeScript parameter ---\n"
        "diff --git a/src/api/client.ts b/src/api/client.ts\n"
        "-async createUser(name: string): Promise<User>\n"
        "+async createUser(name: string, role?: UserRole): Promise<User>\n"
        "version_bump: MINOR\n"
        "reason: Existing callers unaffected \u2014 new parameter is optional.\n\n"
        "--- MINOR: new Java public method ---\n"
        "diff --git a/src/.../UsersClient.java b/src/.../UsersClient.java\n"
        "+    public CompletableFuture<User> getUserAsync(String userId) {\n"
        "+        return this.httpClient.sendAsync(...);\n"
        "+    }\n"
        "version_bump: MINOR\n"
        "reason: New capability added, nothing removed or changed.\n\n"
        "--- MINOR: changed default retry count ---\n"
        "diff --git a/src/core/http_client.py b/src/core/http_client.py\n"
        "-MAX_RETRIES = 3\n"
        "+MAX_RETRIES = 5\n"
        "version_bump: MINOR\n"
        "reason: Changed default retry count \u2014 existing consumers will experience different retry behavior.\n\n"
        "--- PATCH: Go import reorganization ---\n"
        "diff --git a/client.go b/client.go\n"
        '-import "fmt"\n'
        '-import "net/http"\n'
        "+import (\n"
        '+    "fmt"\n'
        '+    "net/http"\n'
        "+)\n"
        "version_bump: PATCH\n"
        "reason: Formatting change only, no functional difference.\n\n"
        "--- End Examples ---"
    )

    if language:
        lang_key = language.lower().strip()
        rules = LANGUAGE_RULES.get(lang_key)
        if rules:
            sections.append(f"\n\n{rules}")
        else:
            sections.append(f"\n\n{GENERIC_LANGUAGE_RULES.format(language=language)}")

    sections.append(
        "\n\nApply these patterns to the diff below. When in doubt between MINOR and PATCH, "
        "prefer MINOR. When in doubt between MAJOR and MINOR, examine whether existing "
        "callers would break without any code changes on their side."
    )

    sections.append(
        "\n\nMessage Format (use this exact structure):\n"
        "```\n"
        "<type>: <short summary>\n\n"
        "<detailed description of what changed and why it matters>\n\n"
        "Key changes:\n"
        "- <change 1>\n"
        "- <change 2>\n"
        "- <change 3>\n\n"
        "\U0001f33f Generated with Fern\n"
        "```"
    )

    sections.append(
        "\n\nMessage Guidelines:\n"
        "- Use conventional commit types: feat, fix, refactor, docs, chore, test, style, perf\n"
        "- Keep the summary line under 72 characters\n"
        '- Write in present tense imperative mood ("add" not "added" or "adds")\n'
        "- For breaking changes: include migration instructions in the detailed description\n"
        "- For new features: highlight new capabilities in the key changes\n"
        "- For PATCH: describe the fix or improvement\n"
        '- For NO_CHANGE: use type "chore" and state that no functional changes were made\n'
        "- Be specific and action-oriented\n"
        '- Always end with the "\U0001f33f Generated with Fern" footer\n'
        '- Do not use "Fern regeneration" in commit messages \u2014 use "SDK regeneration" instead\n'
        '- NEVER include the literal version "505.503.4455" in the commit message \u2014 if you see this placeholder\n'
        '  in the diff, describe changes generically (e.g., "added X-Fern-SDK-Version header")'
    )

    if previous_version:
        sections.append(
            "\n- The previous version is provided for context only. Do not include it "
            "literally in the commit message summary line."
        )

    if prior_changelog:
        sections.append(
            f"\n\nPrior changelog entries (for style reference):\n---\n{prior_changelog}\n---\n"
            "Match the tone and format of these entries in your commit message."
        )

    if spec_commit_message:
        sections.append(
            "\n\nThe API spec change that triggered this SDK generation had the following commit message:\n"
            f'"{spec_commit_message}"\n'
            "Use this as a hint for understanding the intent of the change, but always verify "
            "against the actual diff below. The commit message may be vague or inaccurate."
        )

    if previous_version:
        sections.append(f"\n\nPrevious version: {previous_version}")
    if language:
        sections.append(f"\nSDK language: {language}")

    sections.append(f"\n\nGit Diff:\n---\n{diff}\n---")

    sections.append(
        "\n\nChangelog Entry Guidelines:\n"
        "- Write for SDK consumers, not engineers reading the source code\n"
        '- MAJOR: explain what broke and how to migrate ("The `getUser` method has been\n'
        '  removed. Replace calls with `fetchUser(id)` which returns the same type.")\n'
        '- MINOR: describe the new capability ("New `createPayment()` method available\n'
        '  on `PaymentsClient`.")\n'
        "- PATCH: leave empty string \u2014 patch changes don't warrant changelog entries\n"
        "- NO_CHANGE: leave empty string\n"
        '- Do not use conventional commit prefixes (no "feat:", "fix:", etc.)\n'
        '- Write in third person ("The SDK now supports..." not "Add support for...")\n'
        "- Keep it concise: one to three sentences"
    )

    sections.append(
        "\n\nRemember again that YOU MUST return a structured JSON response with these four fields:\n"
        "- message: A git commit message formatted like the example previously provided\n"
        "- changelog_entry: A user-facing release note (empty string for PATCH)\n"
        "- version_bump: One of: MAJOR, MINOR, PATCH, or NO_CHANGE\n"
        "- version_bump_reason: One sentence explaining WHY this bump level was chosen. "
        "For MAJOR: name the specific breaking symbol(s). For MINOR: name the new capability. "
        "For PATCH: describe the fix. For NO_CHANGE: 'No functional changes detected.'"
    )

    result = "".join(sections)
    return result.replace("{", "{{").replace("}", "}}")


async def _analyze_single_chunk(
    diff: str,
    language: str | None = None,
    previous_version: str | None = None,
    prior_changelog: str | None = None,
    spec_commit_message: str | None = None,
) -> AnalyzeCommitDiffResponse | None:
    prompt = _build_prompt(
        diff=diff,
        language=language,
        previous_version=previous_version,
        prior_changelog=prior_changelog,
        spec_commit_message=spec_commit_message,
    )
    return await generate_anthropic_generic_async(
        response_type=AnalyzeCommitDiffResponse,
        prompt_template=prompt,
        model="claude-4-sonnet-20250514",
    )


CONSOLIDATE_CHANGELOG_PROMPT = """You are a technical writer formatting release notes for a {language} SDK.

The raw change notes below are noisy and repetitive \u2014 many bullets describe the same
change across different packages. Deduplicate aggressively: if the same feature appears
multiple times, merge into one entry.

Raw changelog entries:
---
{raw_entries}
---

Overall version bump: {version_bump}

Produce three outputs:

---

## 1. CHANGELOG.md entry (Keep a Changelog format)

- Group under: `### Breaking Changes`, `### Added`, `### Changed`, `### Fixed`
- Only include sections with entries
- **Bold the symbol name** first, then one tight sentence for SDK consumers
- No code fences \u2014 prose only
- For breaking changes, append the migration action inline

## 2. PR Description

- `## Breaking Changes` section at top (if any)
  - One `###` per breaking change with **Before/After** code fences and a **Migration:** line
- `## What's New` section summarizing added/changed features in prose paragraphs,
  grouped by theme (e.g. logging, streaming, pagination, builder improvements)
- Do NOT list every class that got the same method \u2014 summarize as a single entry

## 3. Version Bump Reason

- One sentence explaining WHY the overall version bump ({version_bump}) was chosen
- For MAJOR: name the specific breaking symbol(s) and explain why existing callers break
- For MINOR: name the new capability added
- For PATCH: describe what was fixed or improved
- Example: "MAJOR because `parserCreateJob` InputStream overloads were removed
  from `RawLabReportClient`, breaking existing callers."

---

Return the three outputs as JSON with keys "consolidated_changelog", "pr_description", and "version_bump_reason"."""


async def _consolidate_changelog(
    raw_entries: str,
    version_bump: str,
    language: str,
) -> ConsolidateChangelogResponse | None:
    result = await generate_anthropic_generic_async(
        response_type=ConsolidateChangelogResponse,
        prompt_template=CONSOLIDATE_CHANGELOG_PROMPT,
        model="claude-4-sonnet-20250514",
        max_tokens=4096,
        raw_entries=raw_entries,
        version_bump=version_bump,
        language=language,
    )
    if result is not None and result.consolidated_changelog.strip():
        return result
    return None


async def _analyze_chunked_diff(
    diff: str,
    language: str | None = None,
    previous_version: str | None = None,
    prior_changelog: str | None = None,
    spec_commit_message: str | None = None,
) -> AnalyzeCommitDiffResponse | None:
    diff_byte_size = len(diff.encode("utf-8"))

    if diff_byte_size > MAX_RAW_DIFF_BYTES:
        LOGGER.warning(
            f"Diff too large for analysis ({diff_byte_size / 1_000_000:.1f}MB, "
            f"limit {MAX_RAW_DIFF_BYTES / 1_000_000}MB). Rejecting."
        )
        raise HTTPException(
            status_code=413,
            detail=(
                f"Diff is too large ({diff_byte_size / 1_000_000:.1f}MB). "
                f"Maximum allowed is {MAX_RAW_DIFF_BYTES / 1_000_000}MB."
            ),
        )

    if diff_byte_size <= MAX_AI_DIFF_BYTES:
        return await _analyze_single_chunk(diff, language, previous_version, prior_changelog, spec_commit_message)

    chunks = chunk_diff(diff, MAX_AI_DIFF_BYTES)
    total_chunks = len(chunks)

    if total_chunks > MAX_CHUNKS:
        LOGGER.info(
            f"Split into {total_chunks} chunks for analysis "
            f"(capped at {MAX_CHUNKS}, skipping {total_chunks - MAX_CHUNKS} low-priority chunks)."
        )
        chunks = chunks[:MAX_CHUNKS]
    else:
        LOGGER.info(f"Split diff ({diff_byte_size} bytes) into {total_chunks} chunks for analysis.")

    best_bump = VersionBump.NO_CHANGE
    best_message: str | None = None
    best_version_bump_reason: str = ""
    changelog_entries: list[str] = []
    any_success = False

    for idx, chunk in enumerate(chunks):
        try:
            result = await _analyze_single_chunk(
                chunk, language, previous_version, prior_changelog, spec_commit_message
            )
            if result is None:
                LOGGER.warning(f"Chunk {idx + 1}/{len(chunks)} returned no result, skipping.")
                continue

            any_success = True

            merged_str = max_version_bump(result.version_bump.value, best_bump.value)
            if merged_str != best_bump.value:
                best_bump = VersionBump(merged_str)
                best_message = result.message
                best_version_bump_reason = (result.version_bump_reason or "").strip()
            elif best_message is None:
                best_message = result.message
                best_version_bump_reason = (result.version_bump_reason or "").strip()

            if result.changelog_entry and result.changelog_entry.strip():
                changelog_entries.append(result.changelog_entry.strip())

            LOGGER.info(f"Chunk {idx + 1}/{len(chunks)}: bump={result.version_bump.value}")

        except Exception:
            LOGGER.exception(f"Error analyzing chunk {idx + 1}/{len(chunks)}")

    if not any_success:
        return None

    aggregated_changelog = ""
    version_bump_reason = best_version_bump_reason
    if len(changelog_entries) == 1:
        aggregated_changelog = changelog_entries[0]
    elif len(changelog_entries) > 1:
        raw_entries = "\n".join(entry if entry.startswith("- ") else f"- {entry}" for entry in changelog_entries)
        try:
            LOGGER.info(f"Consolidating {len(changelog_entries)} changelog entries via AI rollup")
            consolidated = await _consolidate_changelog(
                raw_entries=raw_entries,
                version_bump=best_bump.value,
                language=language or "unknown",
            )
            if consolidated is not None:
                aggregated_changelog = consolidated.consolidated_changelog.strip()
                version_bump_reason = (consolidated.version_bump_reason or "").strip()
            else:
                aggregated_changelog = raw_entries
        except Exception:
            LOGGER.exception("Changelog consolidation failed, using raw entries")
            aggregated_changelog = raw_entries

    return AnalyzeCommitDiffResponse(
        message=best_message or "chore: update SDK\n\nGenerated with Fern",
        version_bump=best_bump,
        changelog_entry=aggregated_changelog,
        version_bump_reason=version_bump_reason,
    )


@fai_app.post(
    "/sdks/analyze-commit-diff",
    response_model=AnalyzeCommitDiffResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def analyze_commit_diff(
    body: AnalyzeCommitDiffRequest = Body(...),
    _token: tuple[str, list[str]] = Depends(verify_org_token),
) -> JSONResponse:
    try:
        result = await _analyze_chunked_diff(
            diff=body.diff,
            language=body.language,
            previous_version=body.previous_version,
            prior_changelog=body.prior_changelog,
            spec_commit_message=body.spec_commit_message,
        )

        if result is None:
            LOGGER.error("Failed to analyze commit diff after retries")
            return JSONResponse(
                status_code=500,
                content={"detail": "Failed to analyze commit diff after multiple attempts"},
            )

        LOGGER.info(f"Successfully analyzed commit diff with version bump: {result.version_bump}")
        return JSONResponse(content=jsonable_encoder(result))

    except HTTPException:
        raise
    except Exception as e:
        LOGGER.exception("Failed to analyze commit diff")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@fai_app.post(
    "/sdks/consolidate-changelog",
    response_model=ConsolidateChangelogResponse,
    openapi_extra={"x-fern-audiences": ["internal"], "security": [{"bearerAuth": []}]},
)
async def consolidate_changelog(
    body: ConsolidateChangelogRequest = Body(...),
    _token: tuple[str, list[str]] = Depends(verify_org_token),
) -> JSONResponse:
    try:
        result = await _consolidate_changelog(
            raw_entries=body.raw_entries,
            version_bump=body.version_bump,
            language=body.language,
        )

        if result is None:
            LOGGER.error("Failed to consolidate changelog after retries")
            return JSONResponse(
                status_code=500,
                content={"detail": "Failed to consolidate changelog after multiple attempts"},
            )

        LOGGER.info("Successfully consolidated changelog")
        return JSONResponse(content=jsonable_encoder(result))

    except Exception as e:
        LOGGER.exception("Failed to consolidate changelog")
        return JSONResponse(status_code=500, content={"detail": str(e)})
