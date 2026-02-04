/* eslint-disable turbo/no-undeclared-env-vars */
if (process.env.NODE_ENV !== "test") {
    try {
        await import("server-only");
    } catch {
        // Ignore if server-only not available (e.g., in scripts)
    }
}

export type { Database as SupabaseDatabase } from "@fern-platform/supabase";
// Re-export from the canonical Supabase package
export { getClient as getSupabaseClient } from "@fern-platform/supabase";
