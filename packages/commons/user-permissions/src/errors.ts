// Supabase errors
export const SUPABASE_ERROR_CODES = ["NOT_CONFIGURED", "QUERY_FAILED", "INSERT_FAILED", "DELETE_FAILED"] as const;

export type SupabaseErrorCode = (typeof SUPABASE_ERROR_CODES)[number];

export interface SupabaseError {
    source: "supabase";
    code: SupabaseErrorCode;
    message: string;
}

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

// Helper factories
export function supabaseError(code: SupabaseErrorCode, message: string): SupabaseError {
    return { source: "supabase", code, message };
}

export function auth0Error(code: Auth0ErrorCode, message: string): Auth0Error {
    return { source: "auth0", code, message };
}
