import type { AuthZPermission } from "@fern-api/user-permissions";
import { useParams } from "next/navigation";
import type { ComponentProps } from "react";
import { DashboardTooltip } from "@/components/editor/DashboardTooltip";
import { Button } from "@/components/ui/button";
import { useAuthZ } from "@/hooks/useAuthZ";
import type { PermissionScope } from ".";

type BaseButtonProps = ComponentProps<typeof Button>;

interface AuthZButtonProps extends BaseButtonProps {
    permission: AuthZPermission;
    /**
     * Optional tooltip/title to show when the user lacks the permission.
     * Defaults to a short permissions message.
     */
    missingPermissionTitle?: string;
    /**
     * Optional resource scope for fine-grained permission checks.
     * When provided, checks if user has the permission for this specific resource.
     */
    permissionScope?: PermissionScope;
}

/**
 * Button wrapper that disables itself unless the current user has the given permission.
 * While permissions are loading or on error, the button is disabled to avoid optimistic actions.
 */
export function AuthZButton({
    permission,
    missingPermissionTitle = "You don't have permission to perform this action",
    disabled: disabledProp,
    loading: loadingProp,
    title,
    permissionScope,
    ...rest
}: AuthZButtonProps) {
    const params = useParams<{ orgName: string }>();
    const authz = useAuthZ(params.orgName);

    const isAllowed =
        authz.type === "loaded" &&
        (permissionScope
            ? authz.value.hasResource(permission, permissionScope.type, permissionScope.id)
            : authz.value.has(permission));

    const isLoadingPermissions = authz.type === "loading" || authz.type === "notStartedLoading";
    const hasError = authz.type === "failed";

    const disabled = disabledProp === true || !isAllowed || isLoadingPermissions || hasError;
    const loading = loadingProp || isLoadingPermissions;

    const computedTitle = disabled && !isAllowed ? (title ?? missingPermissionTitle) : title;

    const { children, ...restWithoutChildren } = rest;

    const button = (
        <Button {...restWithoutChildren} disabled={disabled} loading={loading} title={computedTitle}>
            {loading ? <span className="invisible inline-flex items-center gap-2">{children}</span> : children}
        </Button>
    );

    if (disabled && !isAllowed) {
        return (
            <DashboardTooltip
                content={
                    "You don't have permission to perform this action, contact your administrator if you need access"
                }
            >
                <span className="inline-flex" aria-disabled>
                    {button}
                </span>
            </DashboardTooltip>
        );
    }

    return button;
}
