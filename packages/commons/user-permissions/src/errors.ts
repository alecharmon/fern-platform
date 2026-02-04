// Import Supabase errors from canonical source
import {
    SUPABASE_ERROR_CODES,
    type SupabaseError,
    type SupabaseErrorCode,
    supabaseError
} from "@fern-platform/supabase";

// Re-export Supabase errors
export { SUPABASE_ERROR_CODES, supabaseError, type SupabaseError, type SupabaseErrorCode };

// Auth0 errors
export const AUTH0_ERROR_CODES = ["NOT_CONFIGURED", "API_FAILED", "ROLE_MAPPING_INVALID"] as const;

export type Auth0ErrorCode = (typeof AUTH0_ERROR_CODES)[number];

export interface Auth0Error {
    source: "auth0";
    code: Auth0ErrorCode;
    message: string;
}

// Union type
export type UserPermissionsError = SupabaseError | Auth0Error;

// Helper factory
export function auth0Error(code: Auth0ErrorCode, message: string): Auth0Error {
    return { source: "auth0", code, message };
}
