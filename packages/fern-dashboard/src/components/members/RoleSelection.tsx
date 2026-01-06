"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/utils/utils";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

export type UserRole = "admin" | "editor" | "viewer";
export type ResourceRole = "admin" | "editor" | "viewer";
export type AccessType = "org" | "fine-grained";

export interface Resource {
    id: string;
    label: string;
}

const RESOURCE_ROLE_OPTIONS: { value: ResourceRole; label: string; description: string }[] = [
    { value: "viewer", label: "Viewer", description: "View-only access to this resource" },
    { value: "editor", label: "Editor", description: "Can edit and publish changes" },
    { value: "admin", label: "Admin", description: "Full control of this resource" }
];

export declare namespace RoleSelectionGroup {
    export interface Props {
        // Org-level role
        role: UserRole;
        onRoleChange: (role: UserRole) => void;
        cliEnabled: boolean;
        onCliEnabledChange: (enabled: boolean) => void;
        disabled?: boolean;
        roleLabel?: string;
        id?: string;

        // Access type selection
        accessType?: AccessType;
        onAccessTypeChange?: (accessType: AccessType) => void;
        /**
         * Whether to show the access type selector.
         * @default false
         */
        showAccessTypeSelector?: boolean;

        // Fine-grained resource permissions
        resources?: Resource[];
        resourceRoles?: Record<string, ResourceRole | "none">;
        onResourceRoleChange?: (resourceId: string, role: ResourceRole | "none") => void;
        resourceCliAccess?: Record<string, boolean>;
        onResourceCliAccessChange?: (resourceId: string, enabled: boolean) => void;
        isLoadingResources?: boolean;
        resourcesLabel?: string;
    }
}

export function RoleSelectionGroup({
    role,
    onRoleChange,
    cliEnabled,
    onCliEnabledChange,
    disabled,
    roleLabel = "Role",
    id = "role-selection",
    accessType = "org",
    onAccessTypeChange,
    showAccessTypeSelector = false,
    resources,
    resourceRoles,
    onResourceRoleChange,
    resourceCliAccess,
    onResourceCliAccessChange,
    isLoadingResources = false,
    resourcesLabel = "Resources"
}: RoleSelectionGroup.Props) {
    // CLI is only available for editors (admins have full CLI access by default)
    const showCliSwitch = role === "editor";
    const showRoleControls = !showAccessTypeSelector || accessType === "org";
    const showFineGrainedControls = showAccessTypeSelector && accessType === "fine-grained";

    return (
        <div className="space-y-4">
            {/* Access Type Selection */}
            {showAccessTypeSelector && onAccessTypeChange && (
                <div>
                    <div className="text-gray-1100 mb-3 text-sm font-medium">Access Type</div>
                    <div className="space-y-2">
                        <label
                            className={cn(
                                "flex cursor-pointer items-start space-x-3 rounded-lg border p-3 transition-colors",
                                accessType === "org"
                                    ? "border-primary bg-primary/5"
                                    : "border-gray-200 hover:bg-gray-50",
                                disabled && "cursor-not-allowed opacity-50"
                            )}
                        >
                            <input
                                type="radio"
                                name={`${id}-access-type`}
                                value="org"
                                checked={accessType === "org"}
                                onChange={() => onAccessTypeChange("org")}
                                disabled={disabled}
                                className="mt-1"
                            />
                            <div>
                                <div className="text-sm font-medium">Organization-level access</div>
                                <p className="text-muted-foreground text-xs">
                                    User has access to all resources based on their organization role
                                </p>
                            </div>
                        </label>
                        <label
                            className={cn(
                                "flex cursor-pointer items-start space-x-3 rounded-lg border p-3 transition-colors",
                                accessType === "fine-grained"
                                    ? "border-primary bg-primary/5"
                                    : "border-gray-200 hover:bg-gray-50",
                                disabled && "cursor-not-allowed opacity-50"
                            )}
                        >
                            <input
                                type="radio"
                                name={`${id}-access-type`}
                                value="fine-grained"
                                checked={accessType === "fine-grained"}
                                onChange={() => onAccessTypeChange("fine-grained")}
                                disabled={disabled}
                                className="mt-1"
                            />
                            <div>
                                <div className="text-sm font-medium">Fine-grained access</div>
                                <p className="text-muted-foreground text-xs">
                                    Set specific permissions for each resource
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {/* Role Selection - only show for org-level access */}
            {showRoleControls && (
                <div>
                    <div className="text-gray-1100 mb-2 text-sm font-medium">{roleLabel}</div>
                    <Select value={role} onValueChange={(v) => onRoleChange(v as UserRole)} disabled={disabled}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="viewer" description="Read-only access to the Dashboard and analytics">
                                <span className="font-medium text-sm">Viewer</span>
                            </SelectItem>
                            <SelectItem
                                value="editor"
                                description="Can work with SDKs and documentation, CLI access configurable separately"
                            >
                                <span className="font-medium text-sm">Editor</span>
                            </SelectItem>
                            <SelectItem
                                value="admin"
                                description="Full administrative access including member management and CLI access"
                            >
                                <span className="font-medium text-sm">Admin</span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* CLI Access - only show for editors with org-level access */}
            {showRoleControls && showCliSwitch && (
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor={`${id}-cli-access`} className="text-gray-1100 text-sm">
                            CLI Access
                        </Label>
                        <p className="text-muted-foreground text-xs">
                            Allow user to publish SDKs and documentation sites to production
                        </p>
                    </div>
                    <Switch
                        id={`${id}-cli-access`}
                        checked={cliEnabled}
                        onCheckedChange={onCliEnabledChange}
                        disabled={disabled}
                    />
                </div>
            )}

            {/* Fine-grained Resource Permissions */}
            {showFineGrainedControls && (
                <div className="space-y-3">
                    <div className="text-gray-1100 text-sm font-medium">{resourcesLabel}</div>
                    {isLoadingResources ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="size-5 animate-spin text-gray-500" />
                            <span className="ml-2 text-sm text-gray-500">Loading resources...</span>
                        </div>
                    ) : !resources || resources.length === 0 ? (
                        <div className="text-muted-foreground text-sm py-2">
                            No resources found for this organization.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {resources.map((resource) => {
                                const currentRole = resourceRoles?.[resource.id] ?? "none";
                                const currentCliAccess = resourceCliAccess?.[resource.id] ?? false;
                                const showResourceCli = currentRole === "editor";

                                return (
                                    <div key={resource.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium">{resource.label}</div>
                                            </div>
                                            <Select
                                                value={currentRole}
                                                onValueChange={(value) =>
                                                    onResourceRoleChange?.(resource.id, value as ResourceRole | "none")
                                                }
                                                disabled={disabled}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">
                                                        <span className="text-gray-500">No access</span>
                                                    </SelectItem>
                                                    {RESOURCE_ROLE_OPTIONS.map((roleOption) => (
                                                        <SelectItem
                                                            key={roleOption.value}
                                                            value={roleOption.value}
                                                            description={roleOption.description}
                                                        >
                                                            {roleOption.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {showResourceCli && (
                                            <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
                                                <div className="text-xs text-gray-600">CLI Access</div>
                                                <Switch
                                                    checked={currentCliAccess}
                                                    onCheckedChange={(checked) =>
                                                        onResourceCliAccessChange?.(resource.id, checked)
                                                    }
                                                    disabled={disabled}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
