import type { Roles } from "@fern-api/user-permissions";
import EllipsisHorizontalIcon from "@heroicons/react/24/outline/EllipsisHorizontalIcon";
import Image from "next/image";
import type React from "react";

import { cn } from "@/utils/utils";

import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu";

export declare namespace MemberOrInviteeRow {
    export interface Props {
        title: React.JSX.Element | string;
        subtitle?: React.JSX.Element | string;
        pictureUrl?: string;
        rightContent?: React.JSX.Element;
        dropdownMenuItems?: React.JSX.Element;
        forceShowDropownMenuTrigger?: boolean;
        roles?: Roles[];
    }
}

const ROLE_CONFIG: Record<Roles, { label: string; className: string }> = {
    admin: {
        label: "Admin",
        className: "bg-purple-200 text-purple-900 border-purple-400"
    },
    editor: {
        label: "Editor",
        className: "bg-blue-200 text-blue-900 border-blue-400"
    },
    viewer: {
        label: "Viewer",
        className: "bg-gray-200 text-gray-900 border-gray-400"
    },
    cli: {
        label: "CLI",
        className: "bg-amber-100 text-amber-800 border-amber-400 font-mono"
    },
    fine_grain: {
        label: "Fine-grained",
        className: "bg-gray-200 text-gray-900 border-gray-400"
    }
};

function RoleBadge({ role }: { role: Roles }) {
    const config = ROLE_CONFIG[role];
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

export function MemberOrInviteeRow({
    title,
    subtitle,
    pictureUrl,
    rightContent,
    dropdownMenuItems,
    forceShowDropownMenuTrigger = false,
    roles
}: MemberOrInviteeRow.Props) {
    const shouldShowDropdownMenuTrigger = dropdownMenuItems != null || forceShowDropownMenuTrigger;

    // Sort roles: primary role first, then fine_grain, then CLI last
    const roleOrder: Record<Roles, number> = {
        admin: 0,
        editor: 0,
        viewer: 0,
        fine_grain: 1,
        cli: 2
    };
    const sortedRoles = roles?.slice().sort((a, b) => roleOrder[a] - roleOrder[b]);

    return (
        <div className="border-border flex justify-between border-b p-4 last:border-b-0">
            <div className="flex min-w-0 items-center gap-4">
                <div className="border-border flex size-10 min-w-0 shrink-0 overflow-hidden rounded-full border-2 bg-gray-300">
                    {pictureUrl != null ? (
                        <Image
                            src={pictureUrl}
                            alt={typeof title === "string" ? title : "user picture"}
                            className="object-cover"
                            width={40}
                            height={40}
                        />
                    ) : typeof title === "string" ? (
                        <div className="flex flex-1 items-center justify-center bg-gray-700 text-xl uppercase text-gray-900">
                            {title[0]}
                        </div>
                    ) : null}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold">{title}</span>
                        {sortedRoles && sortedRoles.length > 0 && (
                            <div className="flex gap-1">
                                {sortedRoles.map((role) => (
                                    <RoleBadge key={role} role={role} />
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex text-gray-900">{subtitle}</div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {rightContent}
                <div className="flex">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={dropdownMenuItems == null}>
                            <Button size="icon" variant="ghost">
                                {shouldShowDropdownMenuTrigger && <EllipsisHorizontalIcon className="size-5" />}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">{dropdownMenuItems}</DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
