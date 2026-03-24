"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
        useGroupMappings?: boolean;
    }
}

export function MembersPage({ session, isFernAdmin, isFineGrainedPermissionsEnabled = false, useGroupMappings = false }: MembersPage.Props) {
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
        enabled: isFineGrainedPermissionsEnabled || useGroupMappings,
    });

    const existingMappingsQuery = useQuery({
        queryKey: ["oidc-group-mappings", orgName],
        queryFn: async () => {
            const response = await DashboardApiClient.listOidcGroupMappings({ orgName });
            return response.mappings;
        },
        enabled: useGroupMappings,
    });

    const existingGroupNames = [...new Set(existingMappingsQuery.data?.map((m) => m.groupId) ?? [])];

    const saveMappings = useMutation({
        mutationFn: async (mapping: OidcGroupMappingFormData) => {
            // Delete existing mappings for this group first
            const existingForGroup = existingMappingsQuery.data?.filter(
                (m) => m.groupId === mapping.groupName
            ) ?? [];

            if (existingForGroup.length > 0) {
                await Promise.all(
                    existingForGroup.map((m) =>
                        DashboardApiClient.deleteOidcGroupMapping({
                            orgName,
                            mappingId: m.id,
                        })
                    )
                );
            }

            // Create new mappings
            const resourceEntries = Object.entries(mapping.resourceRoles).filter(
                ([, role]) => role !== "none"
            );

            await Promise.all(
                resourceEntries.map(([resourceId, role]) =>
                    DashboardApiClient.createOidcGroupMapping({
                        orgName,
                        connectionName: mapping.groupName,
                        groupId: mapping.groupName,
                        mappingType: "resource_role",
                        role: role as "admin" | "editor" | "viewer",
                        resourceType: "docs",
                        resourceId,
                    })
                )
            );
        },
        onSuccess: () => {
            toast.success("OIDC group mapping saved");
            setOidcModalOpen(false);
            void existingMappingsQuery.refetch();
        },
        onError: (error) => {
            console.error("Failed to save OIDC group mapping", error);
            toast.error("Failed to save OIDC group mapping");
        },
    });

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
                        {useGroupMappings && (
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
            {useGroupMappings && (
                <OidcGroupMappingModal
                    open={oidcModalOpen}
                    onOpenChange={setOidcModalOpen}
                    onSave={(mapping) => saveMappings.mutate(mapping)}
                    resources={docsSitesQuery.data?.map((site) => ({
                        id: site.url,
                        label: site.url,
                    })) ?? []}
                    existingGroupNames={existingGroupNames}
                    existingMappings={existingMappingsQuery.data?.map((m) => ({
                        groupId: m.groupId,
                        role: m.role,
                        resourceId: m.resourceId,
                    })) ?? []}
                    isLoadingResources={docsSitesQuery.isLoading}
                    isSaving={saveMappings.isPending}
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
