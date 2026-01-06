"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { useCurrentOrganization } from "@/state/useOrganizations";
import { useOrgInvitations } from "@/state/useOrgInvitations";
import { useOrgMembers } from "@/state/useOrgMembers";

import { PageHeader } from "../layout/PageHeader";
import { InviteUserDialog } from "./InviteUserDialog";
import { MembersTable } from "./MembersTable";

export declare namespace MembersPage {
    export interface Props {
        session: Auth0SessionData;
        isFernAdmin: boolean;
        isFineGrainedPermissionsEnabled?: boolean;
    }
}

export function MembersPage({ session, isFernAdmin, isFineGrainedPermissionsEnabled = false }: MembersPage.Props) {
    const org = useCurrentOrganization();
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailToInvite = searchParams.get("emailToInvite");

    // Clear the emailToInvite param after reading it
    useEffect(() => {
        if (emailToInvite != null) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("emailToInvite");
            const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
            router.replace(newUrl, { scroll: false });
        }
    }, [emailToInvite, router, searchParams]);

    const invitations = useOrgInvitations();
    const { members } = useOrgMembers();

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <PageHeader
                title="Members"
                subtitle="Manage team members and invitations"
                farRightContent={
                    <div className="flex md:items-center">
                        <InviteUserDialog
                            org={org}
                            initialEmail={emailToInvite ?? undefined}
                            defaultOpen={emailToInvite != null}
                            isFernAdmin={isFernAdmin}
                        />
                    </div>
                }
            />
            <MembersTable
                members={members}
                invitations={invitations}
                userId={session.user.sub}
                isFineGrainedPermissionsEnabled={isFineGrainedPermissionsEnabled}
            />
        </div>
    );
}
