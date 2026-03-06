import type { AuthZPermission } from "@fern-api/user-permissions";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getCachedOrgPermissionCheck, getCachedPermissionCheck } from "@/app/services/auth/cachedPermissionCheck";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import AccessDeniedContent from "@/components/auth/AccessDeniedContent";
import type { PermissionScope } from ".";

interface AuthZWrapperServerProps {
    permission: AuthZPermission;
    children: ReactNode;
    fallback?: ReactNode;

    /**
     * If true, calls notFound() when permission is denied instead of rendering fallback.
     * This is useful because notFound() must be called lazily (not passed as a prop value).
     */
    notFoundOnDeny?: boolean;

    /**
     * If true, shows an "Access Denied" message when permission is denied.
     * Takes precedence over notFoundOnDeny.
     */
    showAccessDenied?: boolean;

    /**
     * Custom message to show in the access denied content.
     * Only used when showAccessDenied is true.
     */
    accessDeniedMessage?: React.ReactNode;

    /**
     * Optional resource scope for fine-grained permission checks.
     * When provided, checks if user has the permission for this specific resource.
     * If fine-grained permissions are enabled (via feature flag), this will check
     * Supabase-backed resource permissions.
     */
    permissionScope?: PermissionScope;

    /**
     * Org name for feature flag and Supabase permission checks.
     * Required when using permissionScope with fine-grained permissions.
     */
    orgName?: string;
}

/**
 * Server-side wrapper component that only renders children if the user has the given permission.
 * Uses the session directly instead of a client-side hook.
 *
 * Permission checking order:
 * 1. Org-level permission (from Auth0 session)
 * 2. If fine-grained permissions enabled: Supabase resource permissions
 * 3. Fall back to scoped permission strings in session
 */
export async function AuthZWrapperServer({
    permission,
    children,
    fallback = null,
    notFoundOnDeny = false,
    showAccessDenied = false,
    accessDeniedMessage,
    permissionScope,
    orgName
}: AuthZWrapperServerProps): Promise<ReactNode> {
    const session = await getCurrentSession();

    if (!session) {
        return fallback;
    }

    // Sort permissions so the cache key is stable regardless of JWT claim ordering.
    const sessionPermissions = [...(session.permissions ?? [])].sort();
    let allowed: boolean;

    // Use cached permission checks to avoid redundant Supabase calls on every navigation.
    // Permissions are always enforced (ENFORCE_PERMISSIONS flag is fully rolled out).
    if (permissionScope && orgName) {
        const result = await getCachedPermissionCheck(
            session.user.sub,
            orgName,
            sessionPermissions,
            permission,
            permissionScope.type,
            permissionScope.id
        );
        allowed = result.allowed;
    } else if (orgName) {
        const result = await getCachedOrgPermissionCheck(session.user.sub, orgName, sessionPermissions, permission);
        allowed = result.allowed;
    } else {
        // No org context, skip enforcement
        allowed = true;
    }

    if (allowed) {
        return children;
    }

    // showAccessDenied takes precedence over notFoundOnDeny
    if (showAccessDenied) {
        return <AccessDeniedContent message={accessDeniedMessage} />;
    }

    // Call notFound() lazily here instead of accepting it as a prop value
    if (notFoundOnDeny) {
        notFound();
    }

    return fallback;
}
