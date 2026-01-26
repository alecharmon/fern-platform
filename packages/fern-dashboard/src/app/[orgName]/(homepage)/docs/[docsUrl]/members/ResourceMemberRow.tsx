"use client";

import type { ResourceRole } from "@fern-api/user-permissions";
import { CheckIcon, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeUserResourceRole } from "@/app/actions/removeUserResourceRole";
import { setUserResourceRole } from "@/app/actions/setUserResourceRole";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils/utils";
import type { ResourceMember } from "./ResourceMembersPage";

const RESOURCE_ROLES: { value: ResourceRole; label: string; className: string }[] = [
    { value: "admin", label: "Admin", className: "bg-purple-200 text-purple-900 border-purple-400" },
    { value: "editor", label: "Editor", className: "bg-gray-200 text-gray-900 border-gray-400" },
    { value: "viewer", label: "Viewer", className: "bg-blue-200 text-blue-900 border-blue-400" }
];

const RESOURCE_ROLE_CONFIG: Record<string, { label: string; className: string }> = {
    admin: { label: "Admin", className: "bg-purple-200 text-purple-900 border-purple-400" },
    viewer: { label: "Viewer", className: "bg-gray-200 text-gray-900 border-gray-400" },
    editor: { label: "Editor", className: "bg-blue-200 text-blue-900 border-blue-400" }
};

function ResourceRoleBadge({ role }: { role: ResourceRole }) {
    const config = RESOURCE_ROLE_CONFIG[role];
    if (!config) {
        return (
            <span className="inline-flex items-center rounded-md border border-gray-400 bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-900">
                {role}
            </span>
        );
    }
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                config.className
            )}
        >
            {config.label}
        </span>
    );
}

function NoAccessBadge() {
    return (
        <span className="inline-flex items-center rounded-md border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            No access
        </span>
    );
}

export interface ResourceMemberRowProps {
    member: ResourceMember;
    docsUrl: string;
    orgName: Auth0OrgName;
    isCurrentUser: boolean;
}

export function ResourceMemberRow({ member, docsUrl, orgName, isCurrentUser }: ResourceMemberRowProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [optimisticRole, setOptimisticRole] = useState<ResourceRole | undefined>(member.resourceRole);

    const hasResourceAccess = optimisticRole != null;

    const handleSetRole = (newRole: ResourceRole) => {
        const previousRole = optimisticRole;
        setOptimisticRole(newRole);

        startTransition(async () => {
            const result = await setUserResourceRole({
                orgName,
                userId: member.userId as Auth0UserID,
                resourceType: "docs",
                resourceId: docsUrl,
                role: newRole,
                previousRole
            });

            if (!result.success) {
                setOptimisticRole(previousRole);
                toast.error(`Failed to set role: ${result.error}`);
            } else {
                toast.success(`Role updated to ${RESOURCE_ROLE_CONFIG[newRole]?.label ?? newRole}`);
                router.refresh();
            }
        });
    };

    const handleRemoveAccess = () => {
        if (!optimisticRole) {
            return;
        }

        const previousRole = optimisticRole;
        setOptimisticRole(undefined);

        startTransition(async () => {
            const result = await removeUserResourceRole({
                orgName,
                userId: member.userId as Auth0UserID,
                resourceType: "docs",
                resourceId: docsUrl,
                role: previousRole
            });

            if (!result.success) {
                setOptimisticRole(previousRole);
                toast.error(`Failed to remove access: ${result.error}`);
            } else {
                toast.success("Access removed");
                router.refresh();
            }
        });
    };

    return (
        <div
            className={cn(
                "border-border flex justify-between border-b p-4 last:border-b-0",
                !hasResourceAccess && "opacity-60",
                isPending && "opacity-50"
            )}
        >
            <div className="flex min-w-0 items-center gap-4">
                <div className="border-border flex size-10 min-w-0 shrink-0 overflow-hidden rounded-full border-2 bg-gray-300">
                    {member.picture != null ? (
                        <Image src={member.picture} alt={member.name} className="object-cover" width={40} height={40} />
                    ) : (
                        <div className="flex flex-1 items-center justify-center bg-gray-700 text-xl uppercase text-gray-900">
                            {member.name[0]}
                        </div>
                    )}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold">
                            {member.name}
                            {isCurrentUser && <span className="ml-1 text-gray-600">(you)</span>}
                        </span>
                        {optimisticRole ? <ResourceRoleBadge role={optimisticRole} /> : <NoAccessBadge />}
                    </div>
                    <div className="flex text-gray-900">{member.email}</div>
                </div>
            </div>
            <div className="flex items-center">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={isPending}>
                        <Button size="icon" variant="ghost">
                            <MoreHorizontal className="size-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {RESOURCE_ROLES.map((role) => (
                            <DropdownMenuItem
                                key={role.value}
                                onClick={() => handleSetRole(role.value)}
                                disabled={isPending}
                            >
                                <span className="flex items-center gap-2">
                                    {optimisticRole === role.value && <CheckIcon className="size-4" />}
                                    <span className={optimisticRole === role.value ? "font-medium" : ""}>
                                        {role.label}
                                    </span>
                                </span>
                            </DropdownMenuItem>
                        ))}
                        {hasResourceAccess && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    onClick={handleRemoveAccess}
                                    disabled={isPending}
                                >
                                    Remove access
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
