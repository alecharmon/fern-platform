import type { AuthZPermission } from "@fern-api/user-permissions";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useAuthZ } from "@/hooks/useAuthZ";
import type { PermissionScope } from ".";

interface AuthZWrapperProps {
    permission: AuthZPermission;
    children: ReactNode;
    fallback?: ReactNode;
    loadingFallback?: ReactNode;

    /**
     * Optional resource scope for fine-grained permission checks.
     * When provided, checks if user has the permission for this specific resource.
     * If fine-grained permissions are enabled (via feature flag), this will check
     * Supabase-backed resource permissions fetched by the authz API.
     */
    permissionScope?: PermissionScope;
}

/**
 * Wrapper component that only renders children if the user has the given permission.
 * Returns `loadingFallback` while permissions are being fetched and `fallback` when missing or errored.
 *
 * Permission checking order:
 * 1. Org-level permission (from Auth0 session)
 * 2. If fine-grained permissions enabled: Supabase resource permissions (pre-fetched by API)
 * 3. Fall back to scoped permission strings in session
 */
export function AuthZWrapper({
    permission,
    children,
    fallback = null,
    loadingFallback = null,
    permissionScope: resource
}: AuthZWrapperProps) {
    const params = useParams<{ orgName: string }>();
    const authz = useAuthZ(params.orgName);

    if (authz.type === "loaded") {
        if (resource) {
            const { type, id } = resource;
            const hasAccess = authz.value.hasResource(permission, type, id);
            return hasAccess ? <>{children}</> : <>{fallback}</>;
        }

        const hasAccess = authz.value.has(permission);
        return hasAccess ? <>{children}</> : <>{fallback}</>;
    }

    if (authz.type === "failed") {
        console.warn("[AuthZWrapper] Failed to load permissions, showing fallback");
        return <>{fallback}</>;
    }

    return <>{loadingFallback}</>;
}
