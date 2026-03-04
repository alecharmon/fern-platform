import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const FERN_TEMP_PREFIXES = [
    "fern-customize-",
    "fern-token-",
    "fern-retry-workflow-",
    "fern-stream-",
    "fern-setup-repo-"
];

/**
 * Max age in milliseconds before a temp directory is considered stale.
 * Temp directories may persist across multiple onboarding steps (setup,
 * customization, spec upload), so we use a generous 2-hour threshold.
 */
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * Removes stale fern-* temp directories from the OS temp directory.
 *
 * In serverless environments (e.g. Vercel), /tmp has limited space (~512MB)
 * and is shared across warm invocations. If a previous invocation crashed
 * (timeout, OOM) without running its `finally` cleanup block, orphaned
 * temp directories accumulate and eventually cause ENOSPC errors.
 *
 * This function is safe to call at the start of any API route that creates
 * temp directories. It only removes directories that match known fern-*
 * prefixes and are older than 2 hours.
 */
export async function cleanupStaleTempDirs(): Promise<void> {
    const tmpDir = os.tmpdir();

    try {
        const entries = await fs.readdir(tmpDir, { withFileTypes: true });
        const now = Date.now();

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const isFernTempDir = FERN_TEMP_PREFIXES.some((prefix) => entry.name.startsWith(prefix));
            if (!isFernTempDir) {
                continue;
            }

            const fullPath = path.join(tmpDir, entry.name);

            try {
                const stats = await fs.stat(fullPath);
                const ageMs = now - stats.mtimeMs;

                if (ageMs > STALE_THRESHOLD_MS) {
                    await fs.rm(fullPath, { recursive: true, force: true });
                    console.log(
                        `[cleanupStaleTempDirs] Removed stale dir: ${entry.name} (age: ${Math.round(ageMs / 1000)}s)`
                    );
                }
            } catch {
                // If we can't stat or remove a single dir, skip it
            }
        }
    } catch (error) {
        // Non-fatal: if we can't list /tmp, just continue with the request
        console.warn("[cleanupStaleTempDirs] Failed to scan temp directory:", error);
    }
}
