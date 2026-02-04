/**
 * Supabase error codes for client operations.
 */
export const SUPABASE_ERROR_CODES = ["NOT_CONFIGURED", "QUERY_FAILED", "INSERT_FAILED", "DELETE_FAILED"] as const;

export type SupabaseErrorCode = (typeof SUPABASE_ERROR_CODES)[number];

/**
 * Supabase-specific error type.
 */
export interface SupabaseError {
    source: "supabase";
    code: SupabaseErrorCode;
    message: string;
}

/**
 * Factory function to create a SupabaseError.
 */
export function supabaseError(code: SupabaseErrorCode, message: string): SupabaseError {
    return { source: "supabase", code, message };
}
