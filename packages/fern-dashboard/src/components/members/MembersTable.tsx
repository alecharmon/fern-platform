"use client";

import type { Roles } from "@fern-api/user-permissions";
import { getLoadableValue, type Loadable } from "@fern-ui/loadable";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { GetMembers200ResponseOneOfInner } from "auth0";
import { CircleUserRound, Clock, Github } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

import { getMembersLastLogin } from "@/app/actions/getMembersLastLogin";
import type { Auth0UserID } from "@/app/services/auth0/types";
import type { OrgInvitation } from "@/state/types";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { DataTable } from "../ui/data-table/data-table";
import { Skeleton } from "../ui/skeleton";
import { MemberActionsCell } from "./MemberActionsCell";
import { RoleBadge } from "./MemberOrInviteeRow";
import { getLoginType, getRelativeTimeString, type LoginType, type MemberTableRow } from "./member-table-utils";

const VALID_ROLES: Roles[] = ["admin", "editor", "viewer", "cli", "fine_grain"];

export declare namespace MembersTable {
    export interface Props {
        userId: Auth0UserID;
        members: Loadable<GetMembers200ResponseOneOfInner[]>;
        invitations: Loadable<OrgInvitation[]>;
        isFineGrainedPermissionsEnabled?: boolean;
    }
}

const GOOGLE_ICON = (
    <svg className="size-4" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M16.04 8.15c0-.56-.05-1.09-.14-1.6H8.53v3.03h4.21a3.6 3.6 0 0 1-1.57 2.38l2.54 1.97c1.48-1.37 2.33-3.37 2.33-5.78Z"
            fill="currentColor"
        />
        <path
            d="M8.53 15.79c2.11 0 3.88-.7 5.18-1.9l-2.54-1.97a5.18 5.18 0 0 1-7.01-2.47l-2.6 2.02a8.53 8.53 0 0 0 6.97 4.32Z"
            fill="currentColor"
        />
        <path
            d="M4.15 9.45A4.93 4.93 0 0 1 3.9 7.97c0-.49.09-.98.25-1.49L1.55 4.46a8.44 8.44 0 0 0 0 7.01l2.6-2.02Z"
            fill="currentColor"
        />
        <path
            d="M8.53 3.26c1.15 0 2.18.4 2.99 1.17l2.24-2.24A8.38 8.38 0 0 0 8.53.15a8.53 8.53 0 0 0-6.98 4.31l2.6 2.02c.62-1.85 2.35-3.22 4.38-3.22Z"
            fill="currentColor"
        />
    </svg>
);

const POSTMAN_ICON = (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M13.3529 2.05532L7.51595 9.38934L13.2922 13.9988C14.9526 12.5328 16 10.3889 16 8.00015C16 5.61146 14.9778 3.51976 13.3529 2.05532ZM13.5214 9.99203C13.4067 9.99203 13.2907 9.96124 13.1862 9.89625C12.887 9.7109 12.7946 9.31781 12.98 9.01864C12.9946 8.99096 13.2129 8.66598 13.2714 8.19794C13.3299 7.66584 13.1374 7.24166 13.0341 7.05817C13.0158 7.02645 12.9962 6.99473 12.9753 6.96301C12.7828 6.66819 12.8817 6.27044 13.1812 6.08509C13.2857 6.02041 13.4017 5.98931 13.5165 5.98931C13.6987 5.98931 13.8772 6.06768 14.0007 6.21198L14.0038 6.20949C14.028 6.24245 14.1975 6.47943 14.3427 6.85852C14.4127 7.0392 14.4656 7.22331 14.5007 7.40959C14.6534 8.19452 14.5035 8.98008 14.0635 9.69037C13.9428 9.88505 13.7351 9.99203 13.5214 9.99203ZM6.22286 9.98861C5.94795 9.76905 5.90254 9.3685 6.12179 9.09328L12.3409 1.2794C11.0904 0.470213 9.60019 0 8.00015 0C3.58164 0 0 3.58164 0 8.00015C0 12.4187 3.58164 16 7.99984 16C9.5554 16 11.0071 15.5556 12.2355 14.7871L6.22286 9.98861Z"
            fill="currentColor"
        />
    </svg>
);

const LOGIN_TYPE_ICON: Record<LoginType, React.ReactNode> = {
    Google: GOOGLE_ICON,
    GitHub: <Github className="size-4" />,
    Postman: POSTMAN_ICON,
    SSO: <CircleUserRound className="size-4" />,
    Pending: <Clock className="size-4" />
};

function buildColumns(
    userId: Auth0UserID,
    isFineGrainedPermissionsEnabled: boolean
): ColumnDef<MemberTableRow, unknown>[] {
    return [
        {
            accessorKey: "name",
            header: "Name",
            enableColumnFilter: false,
            enableSorting: false,
            cell: ({ row }) => {
                const { name, email, pictureUrl } = row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className="border-border flex size-10 shrink-0 overflow-hidden rounded-full border-2 bg-gray-300">
                            {pictureUrl ? (
                                <Image src={pictureUrl} alt={name} className="object-cover" width={40} height={40} />
                            ) : (
                                <div className="flex flex-1 items-center justify-center bg-gray-700 text-xl uppercase text-gray-900">
                                    {name[0]}
                                </div>
                            )}
                        </div>
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate font-bold">{name}</span>
                            <span className="truncate text-sm text-muted-foreground">{email}</span>
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: "roles",
            header: "Role",
            enableColumnFilter: true,
            enableSorting: true,
            meta: { width: 120 },
            accessorFn: (row) => {
                const ROLE_PRIORITY: Roles[] = ["admin", "editor", "viewer", "fine_grain"];
                return ROLE_PRIORITY.find((r) => row.roles.includes(r)) ?? "";
            },
            cell: ({ row }) => {
                // Show only the primary role (admin > editor > viewer > fine_grain), hide CLI
                const ROLE_PRIORITY: Roles[] = ["admin", "editor", "viewer", "fine_grain"];
                const primaryRole = ROLE_PRIORITY.find((r) => row.original.roles.includes(r));
                if (!primaryRole) {
                    return null;
                }
                return <RoleBadge role={primaryRole} />;
            }
        },
        {
            accessorKey: "lastLogin",
            header: "Latest login",
            enableColumnFilter: false,
            enableSorting: true,
            meta: { width: 160 },
            cell: ({ row }) => {
                if (row.original.lastLoginLoading) {
                    return <Skeleton className="h-4 w-20" />;
                }
                return (
                    <span className="text-sm text-muted-foreground">
                        {getRelativeTimeString(row.original.lastLogin)}
                    </span>
                );
            }
        },
        {
            accessorKey: "loginType",
            header: "Login type",
            enableColumnFilter: true,
            enableSorting: true,
            meta: { width: 160 },
            cell: ({ getValue }) => {
                const loginType = getValue() as LoginType;
                return (
                    <div className="flex items-center gap-2 text-sm">
                        {LOGIN_TYPE_ICON[loginType]}
                        <span>{loginType}</span>
                    </div>
                );
            }
        },
        {
            id: "actions",
            header: "",
            enableColumnFilter: false,
            enableSorting: false,
            meta: { width: 60 },
            cell: ({ row }) => (
                <MemberActionsCell
                    row={row.original}
                    currentUserId={userId}
                    isFineGrainedPermissionsEnabled={isFineGrainedPermissionsEnabled}
                />
            )
        }
    ];
}

export function MembersTable({
    userId,
    members,
    invitations,
    isFineGrainedPermissionsEnabled = false
}: MembersTable.Props) {
    const loadedInvitations = getLoadableValue(invitations);
    const loadedMembers = getLoadableValue(members);
    const isLoading = loadedInvitations == null || loadedMembers == null;
    const orgName = useOrgNameFromPathname();

    // Fetch last_login async — doesn't block the table from rendering
    const memberUserIds = useMemo(() => loadedMembers?.map((m) => m.user_id) ?? [], [loadedMembers]);
    const lastLoginQuery = useQuery({
        queryKey: ["members-last-login", orgName, memberUserIds],
        queryFn: () => getMembersLastLogin({ orgName, userIds: memberUserIds }),
        enabled: memberUserIds.length > 0
    });
    const lastLoginMap = lastLoginQuery.data;
    const lastLoginLoading = lastLoginQuery.isLoading;

    const rows: MemberTableRow[] = useMemo(() => {
        const result: MemberTableRow[] = [];

        if (loadedInvitations) {
            for (const invitation of loadedInvitations) {
                result.push({
                    id: invitation.id ?? invitation.inviteeEmail,
                    name: invitation.inviteeEmail,
                    email: invitation.inviteeEmail,
                    roles: [],
                    loginType: "Pending",
                    kind: "invitee",
                    raw: invitation
                });
            }
        }

        if (loadedMembers) {
            for (const member of loadedMembers) {
                const memberRoles = member.roles
                    .map((role) => role.name)
                    .filter((role): role is Roles => VALID_ROLES.includes(role as Roles));

                result.push({
                    id: member.user_id,
                    name: member.name,
                    email: member.email,
                    pictureUrl: member.picture,
                    roles: memberRoles,
                    lastLogin: lastLoginMap?.[member.user_id],
                    lastLoginLoading,
                    loginType: getLoginType(member.user_id),
                    kind: "member",
                    raw: member
                });
            }
        }

        return result;
    }, [loadedInvitations, loadedMembers, lastLoginMap, lastLoginLoading]);

    const columns = useMemo(
        () => buildColumns(userId, isFineGrainedPermissionsEnabled),
        [userId, isFineGrainedPermissionsEnabled]
    );

    return (
        <DataTable
            columns={columns}
            data={rows}
            initialPageSize={1000}
            className="overflow-hidden rounded-xl border border-border"
        >
            <DataTable.Content
                loading={isLoading && rows.length > 0}
                className="[&_thead_tr_th]:border-b [&_thead_tr_th]:border-border [&_tbody_tr:not(:last-child)_td]:border-b [&_tbody_tr:not(:last-child)_td]:border-border"
            >
                <DataTable.Header className="[&_th]:font-normal [&_th]:text-muted-foreground" />
                <DataTable.Body
                    loading={isLoading}
                    emptyState={<span className="text-muted-foreground">No members found.</span>}
                />
            </DataTable.Content>
        </DataTable>
    );
}
