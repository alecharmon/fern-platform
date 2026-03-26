"use client";

import { Check, ChevronsUpDown, Plus, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/utils/utils";
import { Button } from "../ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { type AccessType, type Resource, type ResourceRole, RoleSelectionGroup, type UserRole } from "./RoleSelection";

export interface OidcGroupMappingFormData {
    groupName: string;
    accessType: AccessType;
    orgRole: UserRole;
    cliEnabled: boolean;
    resourceRoles: Record<string, ResourceRole | "none">;
    resourceCliAccess: Record<string, boolean>;
}

export interface ExistingGroupMapping {
    groupId: string;
    mappingType: "org_role" | "resource_role";
    role: ResourceRole;
    resourceId?: string;
}

export declare namespace OidcGroupMappingModal {
    export interface Props {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        onSave: (mapping: OidcGroupMappingFormData) => void;
        resources: Resource[];
        existingGroupNames?: string[];
        existingMappings?: ExistingGroupMapping[];
        isLoadingResources?: boolean;
        isSaving?: boolean;
    }
}

export function OidcGroupMappingModal({
    open,
    onOpenChange,
    onSave,
    resources,
    existingGroupNames = [],
    existingMappings = [],
    isLoadingResources,
    isSaving
}: OidcGroupMappingModal.Props) {
    const [groupName, setGroupName] = useState("");
    const [accessType, setAccessType] = useState<AccessType>("org");
    const [orgRole, setOrgRole] = useState<UserRole>("viewer");
    const [cliEnabled, setCliEnabled] = useState(false);
    const [resourceRoles, setResourceRoles] = useState<Record<string, ResourceRole | "none">>({});
    const [resourceCliAccess, setResourceCliAccess] = useState<Record<string, boolean>>({});
    const [groupPickerOpen, setGroupPickerOpen] = useState(false);
    const [groupSearch, setGroupSearch] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setGroupName("");
            setAccessType("org");
            setOrgRole("viewer");
            setCliEnabled(false);
            setResourceRoles({});
            setResourceCliAccess({});
            setGroupSearch("");
            setGroupPickerOpen(false);
        }
    }, [open]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (groupPickerOpen) {
            requestAnimationFrame(() => searchInputRef.current?.focus());
        }
    }, [groupPickerOpen]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!groupPickerOpen) {
            return;
        }
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setGroupPickerOpen(false);
                setGroupSearch("");
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [groupPickerOpen]);

    const filteredGroups = useMemo(() => {
        const query = groupSearch.toLowerCase().trim();
        if (!query) {
            return existingGroupNames;
        }
        return existingGroupNames.filter((name) => name.toLowerCase().includes(query));
    }, [existingGroupNames, groupSearch]);

    const showCreateOption =
        groupSearch.trim() !== "" &&
        !existingGroupNames.some((name) => name.toLowerCase() === groupSearch.toLowerCase().trim());

    const selectGroup = (name: string) => {
        setGroupName(name);
        setGroupPickerOpen(false);
        setGroupSearch("");

        // Pre-fill from existing mappings for this group
        const groupMappings = existingMappings.filter((m) => m.groupId === name);
        if (groupMappings.length > 0) {
            const hasOrgRole = groupMappings.some((m) => m.mappingType === "org_role");
            if (hasOrgRole) {
                const orgMapping = groupMappings.find((m) => m.mappingType === "org_role");
                setAccessType("org");
                setOrgRole((orgMapping?.role as UserRole) ?? "viewer");
                setCliEnabled(false);
                setResourceRoles({});
            } else {
                setAccessType("fine-grained");
                const roles: Record<string, ResourceRole | "none"> = {};
                for (const mapping of groupMappings) {
                    if (mapping.resourceId) {
                        roles[mapping.resourceId] = mapping.role;
                    }
                }
                setResourceRoles(roles);
                setOrgRole("viewer");
                setCliEnabled(false);
            }
        } else {
            setAccessType("org");
            setOrgRole("viewer");
            setCliEnabled(false);
            setResourceRoles({});
        }
        setResourceCliAccess({});
    };

    const handleResourceRoleChange = useCallback((resourceId: string, role: ResourceRole | "none") => {
        setResourceRoles((prev) => ({ ...prev, [resourceId]: role }));
    }, []);

    const handleResourceCliAccessChange = useCallback((resourceId: string, enabled: boolean) => {
        setResourceCliAccess((prev) => ({ ...prev, [resourceId]: enabled }));
    }, []);

    const hasAnyResourceRole = Object.values(resourceRoles).some((role) => role !== "none");
    const hasValidRole = accessType === "org" || hasAnyResourceRole;
    const isSaveDisabled = groupName.trim() === "" || !hasValidRole || isSaving === true;

    const handleSave = () => {
        if (isSaveDisabled) {
            return;
        }
        onSave({
            groupName: groupName.trim(),
            accessType,
            orgRole,
            cliEnabled,
            resourceRoles,
            resourceCliAccess
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="md:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add OIDC Group Mapping</DialogTitle>
                    <DialogDescription>Map an identity provider group to permissions.</DialogDescription>
                </DialogHeader>
                <div className="mx-6 mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <p className="text-xs">
                        Saving changes to group mappings will log out all other members in the organization so updated
                        permissions take effect.
                    </p>
                </div>
                <DialogBody>
                    <div className="space-y-4">
                        <div ref={containerRef}>
                            <Label htmlFor="oidc-group-name">OIDC Group Name</Label>
                            {!groupPickerOpen ? (
                                <Button
                                    id="oidc-group-name"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={groupPickerOpen}
                                    className="w-full justify-between font-normal"
                                    onClick={() => setGroupPickerOpen(true)}
                                >
                                    {groupName || (
                                        <span className="text-gray-800">Select or create an OIDC group...</span>
                                    )}
                                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                            ) : (
                                <div className="rounded-md border border-border bg-popover shadow-md">
                                    <div className="p-2">
                                        <Input
                                            ref={searchInputRef}
                                            placeholder="Search or add group"
                                            value={groupSearch}
                                            onChange={(e) => setGroupSearch(e.currentTarget.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    if (showCreateOption) {
                                                        selectGroup(groupSearch.trim());
                                                    } else if (
                                                        filteredGroups.length === 1 &&
                                                        filteredGroups[0] != null
                                                    ) {
                                                        selectGroup(filteredGroups[0]);
                                                    }
                                                }
                                                if (e.key === "Escape") {
                                                    setGroupPickerOpen(false);
                                                    setGroupSearch("");
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {filteredGroups.map((name) => (
                                            <button
                                                key={name}
                                                type="button"
                                                className={cn(
                                                    "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm",
                                                    "hover:bg-accent",
                                                    groupName === name && "bg-accent"
                                                )}
                                                onClick={() => selectGroup(name)}
                                            >
                                                <Check
                                                    className={cn(
                                                        "size-4 shrink-0",
                                                        groupName === name ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {name}
                                            </button>
                                        ))}
                                        {showCreateOption && (
                                            <button
                                                type="button"
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                                                onClick={() => selectGroup(groupSearch.trim())}
                                            >
                                                <Plus className="size-4 shrink-0" />
                                                Create &quot;{groupSearch.trim()}&quot;
                                            </button>
                                        )}
                                        {filteredGroups.length === 0 && !showCreateOption && (
                                            <div className="px-3 py-2 text-sm text-muted-foreground">
                                                No groups found.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {groupName.trim() !== "" && (
                            <RoleSelectionGroup
                                accessType={accessType}
                                onAccessTypeChange={setAccessType}
                                showAccessTypeSelector={true}
                                role={orgRole}
                                onRoleChange={setOrgRole}
                                cliEnabled={cliEnabled}
                                onCliEnabledChange={setCliEnabled}
                                resources={resources}
                                resourceRoles={resourceRoles}
                                onResourceRoleChange={handleResourceRoleChange}
                                resourceCliAccess={resourceCliAccess}
                                onResourceCliAccessChange={handleResourceCliAccessChange}
                                isLoadingResources={isLoadingResources}
                                id="oidc-group-mapping"
                            />
                        )}
                    </div>
                </DialogBody>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaveDisabled} loading={isSaving}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
