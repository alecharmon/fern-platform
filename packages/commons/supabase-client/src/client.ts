import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { err, ok, type Result } from "neverthrow";

import type { Database } from "./database.types";
import { type SupabaseError, supabaseError } from "./errors";

// Internal singleton for lazy loading
let supabaseClient: SupabaseClient<Database> | undefined;

/**
 * Get a singleton Supabase client instance.
 * Lazy loads and auto-initializes from environment variables on first use.
 *
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * @throws Error if environment variables are not configured
 */
export function getClient(): SupabaseClient<Database> {
    if (supabaseClient != null) {
        return supabaseClient;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error("Supabase URL not configured. Set SUPABASE_URL environment variable.");
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        throw new Error(
            "Supabase service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY environment variable."
        );
    }

    supabaseClient = createClient<Database>(supabaseUrl, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    return supabaseClient;
}

/**
 * Get a Supabase client, returning a Result instead of throwing.
 */
export function getClientResult(): Result<SupabaseClient<Database>, SupabaseError> {
    if (supabaseClient != null) {
        return ok(supabaseClient);
    }
    try {
        const client = getClient();
        return ok(client);
    } catch (e) {
        return err(
            supabaseError(
                "NOT_CONFIGURED",
                "Could not initialize Supabase client: " + (e instanceof Error ? e.message : String(e))
            )
        );
    }
}

/**
 * Reset the singleton client (useful for testing).
 * @internal
 */
export function resetClient(): void {
    supabaseClient = undefined;
}
