"use client";

import type { ResourceRole } from "@fern-api/user-permissions";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResourceMemberRow } from "./ResourceMemberRow";

export interface ResourceMember {
    userId: string;
    name: string;
    email: string;
    picture?: string;
    /** Role specific to this resource (undefined if user has no resource-level access) */
    resourceRole?: ResourceRole;
}

export interface ResourceMembersPageProps {
    docsUrl: string;
    orgName: Auth0OrgName;
    members: ResourceMember[];
    currentUserId: Auth0UserID;
}

export function ResourceMembersPage({ docsUrl, orgName, members, currentUserId }: ResourceMembersPageProps) {
    // Sort members: those with resource access first, then alphabetically by name
    const sortedMembers = [...members].sort((a, b) => {
        if (a.resourceRole && !b.resourceRole) {
            return -1;
        }
        if (!a.resourceRole && b.resourceRole) {
            return 1;
        }
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <PageHeader title="Members" subtitle={`Manage access to ${docsUrl}`} />
            <div className="border-border flex flex-col rounded-xl border bg-gray-100">
                {sortedMembers.length === 0 ? (
                    <div className="p-8 text-center text-gray-600">No members in this organization.</div>
                ) : (
                    sortedMembers.map((member) => (
                        <ResourceMemberRow
                            key={member.userId}
                            member={member}
                            docsUrl={docsUrl}
                            orgName={orgName}
                            isCurrentUser={member.userId === currentUserId}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
