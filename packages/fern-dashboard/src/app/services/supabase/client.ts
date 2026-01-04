/* eslint-disable turbo/no-undeclared-env-vars */
if (process.env.NODE_ENV !== "test") {
    require("server-only");
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsRecordInsert, CustomDomainVerificationInsert } from "./types";

// Using generic type for more flexibility with table operations
type SupabaseDatabase = {
    public: {
        Tables: {
            AnalyticsRecord: {
                Row: Record<string, unknown>;
                Insert: AnalyticsRecordInsert;
                Update: Partial<AnalyticsRecordInsert>;
            };
            CustomDomainVerification: {
                Row: Record<string, unknown>;
                Insert: CustomDomainVerificationInsert;
                Update: Partial<CustomDomainVerificationInsert>;
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: {
            DomainVerificationStatus: "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";
        };
    };
};

let supabaseClient: SupabaseClient<SupabaseDatabase> | undefined;

/**
 * Parse DATABASE_URL to extract project ID for constructing REST API URL
 * Format: postgresql://postgres.{PROJECT_ID}:{PASSWORD}@{HOST}:{PORT}/{DB}?pgbouncer=true
 */
function extractProjectId(databaseUrl: string): string {
    const url = new URL(databaseUrl);

    // Extract project ID from username (format: postgres.{PROJECT_ID})
    const usernameParts = url.username.split(".");
    if (usernameParts.length < 2) {
        throw new Error("DATABASE_URL username must be in format 'postgres.{PROJECT_ID}'");
    }
    return usernameParts[1]!;
}

/**
 * Get a singleton Supabase client instance for server-side operations
 *
 * Requires:
 * - DATABASE_URL: PostgreSQL connection URL (used to extract project ID)
 * - SUPABASE_SERVICE_ROLE_KEY, SUPABASE_API_KEY, or SUPABASE_SERVICE_KEY: Service role API key for REST API access
 */
export function getSupabaseClient(): SupabaseClient<SupabaseDatabase> {
    if (supabaseClient != null) {
        return supabaseClient;
    }

    const databaseUrl = process.env.DATABASE_URL;
    const serviceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is required");
    }
    if (!serviceKey) {
        throw new Error(
            "One of the following environment variables is required: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_API_KEY, or SUPABASE_SERVICE_KEY"
        );
    }

    const projectId = extractProjectId(databaseUrl);
    const supabaseUrl = `https://${projectId}.supabase.co`;

    supabaseClient = createClient<SupabaseDatabase>(supabaseUrl, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });

    return supabaseClient;
}
