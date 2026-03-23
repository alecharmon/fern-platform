"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useCurrentOrganization } from "@/state/useOrganizations";
import { useOrgInvitations } from "@/state/useOrgInvitations";
import { useOrgMembers } from "@/state/useOrgMembers";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { ClientEntitlementGate } from "../entitlements/ClientEntitlementGate";
import { PageHeader } from "../layout/PageHeader";
import { Button } from "../ui/button";
import { InviteUserDialog } from "./InviteUserDialog";
import { MembersTable } from "./MembersTable";
import { OidcGroupMappingModal, type OidcGroupMappingFormData } from "./OidcGroupMappingModal";
import { SeatUsageButton } from "./SeatUsageButton";

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
    const orgName = useOrgNameFromPathname();
    const [oidcModalOpen, setOidcModalOpen] = useState(false);

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

    const docsSitesQuery = useQuery({
        queryKey: ["docs-sites", orgName],
        queryFn: async () => {
            const response = await DashboardApiClient.getDocsSites({ orgName });
            if (!response.ok) {
                throw new Error(response.error ?? "Failed to fetch docs sites");
            }
            return response.docsSites ?? [];
        },
        enabled: isFineGrainedPermissionsEnabled && oidcModalOpen,
    });

    const handleOidcSave = (_mapping: OidcGroupMappingFormData) => {
        // TODO: call OIDC group mapping API once available
        setOidcModalOpen(false);
    };

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <PageHeader
                title="Members"
                subtitle="Manage team members and invitations"
                farRightContent={
                    <div className="flex items-center gap-2">
                        <ClientEntitlementGate required="can_purchase_additional_seats">
                            <SeatUsageButton />
                        </ClientEntitlementGate>
                        {isFineGrainedPermissionsEnabled && (
                            <Button variant="outline" onClick={() => setOidcModalOpen(true)}>
                                Add OIDC Group Mapping
                            </Button>
                        )}
                        <InviteUserDialog
                            org={org}
                            initialEmail={emailToInvite ?? undefined}
                            defaultOpen={emailToInvite != null}
                            isFernAdmin={isFernAdmin}
                        />
                    </div>
                }
            />
            {isFineGrainedPermissionsEnabled && (
                <OidcGroupMappingModal
                    open={oidcModalOpen}
                    onOpenChange={setOidcModalOpen}
                    onSave={handleOidcSave}
                    resources={docsSitesQuery.data?.map((site) => ({
                        id: site.url,
                        label: site.url,
                    })) ?? []}
                    isLoadingResources={docsSitesQuery.isLoading}
                />
            )}
            <MembersTable
                members={members}
                invitations={invitations}
                userId={session.user.sub}
                isFineGrainedPermissionsEnabled={isFineGrainedPermissionsEnabled}
            />
        </div>
    );
}
