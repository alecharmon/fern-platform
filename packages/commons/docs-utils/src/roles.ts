import { EVERYONE_ROLE } from "./constants";

/**
 * Encode roles into a URL-safe path segment.
 * Roles are deduplicated, sorted alphabetically, and joined with commas.
 *
 * @param roles - Array of role strings to encode
 * @returns URL-encoded, comma-separated roles string
 */
export function encodeRoles(roles: string[]): string {
    const uniqueRoles = Array.from(new Set(roles));
    return encodeURIComponent(uniqueRoles.sort().join(","));
}

/**
 * Decodes a URL-encoded roles parameter into an array of role strings.
 * Ensures that the "everyone" role is always included.
 *
 * @param rolesParam - URL-encoded, comma-separated roles string (e.g., "admin%2Cdeveloper%2Ceveryone")
 * @returns Array of role strings with "everyone" always included
 */
export function decodeRoles(rolesParam: string): string[] {
    const decoded = decodeURIComponent(rolesParam);
    const roles = decoded.split(",").filter(Boolean);
    if (!roles.includes(EVERYONE_ROLE)) {
        roles.push(EVERYONE_ROLE);
    }
    return roles;
}

/**
 * Boolean path parameter type for type safety
 */
export type BoolParam = "true" | "false";

/**
 * Encodes a boolean value as a path parameter string
 */
export function encodeBool(value: boolean): BoolParam {
    return value ? "true" : "false";
}

/**
 * Decodes a path parameter string to a boolean value
 */
export function decodeBool(param: string | undefined): boolean {
    return param === "true";
}

/**
 * Auth context decoded from path parameters
 */
export interface PathAuthContext {
    roles: string[];
    isLoggedIn: boolean;
    requiresLogin: boolean;
}

/**
 * Decodes all auth-related path parameters into a structured object
 * Path order: [requiresLogin]/[isLoggedIn]/[roles]
 */
export function decodeAuthContextFromParams(params: {
    roles: string;
    isLoggedIn: string;
    requiresLogin: string;
}): PathAuthContext {
    return {
        roles: decodeRoles(params.roles),
        isLoggedIn: decodeBool(params.isLoggedIn),
        requiresLogin: decodeBool(params.requiresLogin)
    };
}
