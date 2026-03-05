import path from "path";

/**
 * Storage state file path used by all authenticated tests.
 * This file is created by the auth setup and consumed
 * by test projects via storageState in playwright.config.ts.
 *
 * Extracted into its own module so playwright.config.ts can
 * import it without triggering test() calls in auth.setup.ts.
 */
export const AUTH_STATE_PATH = path.resolve(__dirname, "../.auth/state.json");
