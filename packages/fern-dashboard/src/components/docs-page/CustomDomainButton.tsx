"use client";

import { CircleDashedIcon, ClockIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import { useEntitlement } from "@/state/useEntitlement";
import { fernCliConfig } from "@/utils/fernCliConfig";
import type { DocsUrl } from "@/utils/types";
import { docsPermissionScope } from "../auth/authz";
import { AuthZButton } from "../auth/authz/AuthZButton";
import { AddCustomDomainModal } from "../settings/AddCustomDomainModal";
import { RemoveCustomDomainModal } from "../settings/RemoveCustomDomainModal";
import { Button } from "../ui/button";
import { useUpsell } from "../upsells/UpsellProvider";

interface CustomDomainButtonProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    domainInfo?: CustomDomainInfo;
    allDomains?: string[];
}

function isFernManagedDomain(domain: string): boolean {
    return domain.endsWith(`.${fernCliConfig.docsDomain}`);
}

export function CustomDomainButton({ docsUrl, orgName, domainInfo, allDomains = [] }: CustomDomainButtonProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const { isEntitled } = useEntitlement("number_of_custom_domains");
    const { openUpsell } = useUpsell();

    // Check if any domain is already a custom domain (not *.docs.buildwithfern.com)
    const existingCustomDomain = allDomains.find((domain) => !isFernManagedDomain(domain));

    // No domainInfo - show add button (unless there's already a custom domain)
    if (!domainInfo) {
        if (existingCustomDomain) {
            return null;
        }

        return (
            <>
                <AuthZButton
                    permission="manage-settings"
                    permissionScope={docsPermissionScope(docsUrl)}
                    variant="ghost"
                    size="xs"
                    onClick={() => (isEntitled ? setShowAddModal(true) : openUpsell("custom_domains"))}
                    className="text-green-1100 hover:bg-green-200 hover:text-green-1100 w-fit -ml-1"
                >
                    <CircleDashedIcon className="size-3.5" />
                    Add custom domain
                </AuthZButton>
                <AddCustomDomainModal
                    open={showAddModal}
                    onOpenChange={setShowAddModal}
                    docsUrl={docsUrl}
                    orgName={orgName}
                />
            </>
        );
    }

    // Domain fully verified — hide the button entirely
    if (domainInfo.status === "VERIFIED") {
        return null;
    }

    // In-progress setup (needs config or earlier steps)
    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="xs"
                onClick={() => setShowAddModal(true)}
                className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
                <ClockIcon className="size-3" />
                Finish custom domain setup
            </Button>
            <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setShowRemoveModal(true)}
                className="text-muted-foreground hover:text-destructive"
            >
                <TrashIcon className="size-3.5" />
            </Button>
            <AddCustomDomainModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                docsUrl={docsUrl}
                orgName={orgName}
                existingDomainInfo={domainInfo}
            />
            <RemoveCustomDomainModal
                open={showRemoveModal}
                onOpenChange={setShowRemoveModal}
                domain={domainInfo.domain}
                docsUrl={docsUrl}
                orgName={orgName}
            />
        </div>
    );
}
