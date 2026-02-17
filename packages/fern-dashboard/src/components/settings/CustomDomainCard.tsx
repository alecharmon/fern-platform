"use client";

import { CheckCircleIcon, ClockIcon, GlobeIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import { fernCliConfig } from "@/utils/fernCliConfig";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { AddCustomDomainModal } from "./AddCustomDomainModal";
import { RemoveCustomDomainModal } from "./RemoveCustomDomainModal";

interface CustomDomainCardProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    domainInfo?: CustomDomainInfo;
    allDomains?: string[];
}

function isFernManagedDomain(domain: string): boolean {
    return domain.endsWith(`.${fernCliConfig.docsDomain}`);
}

export function CustomDomainCard({ docsUrl, orgName, domainInfo, allDomains = [] }: CustomDomainCardProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRemoveModal, setShowRemoveModal] = useState(false);

    // Check if any domain is a custom domain (not a *.docs.buildwithfern.com domain)
    const existingCustomDomain = allDomains.find((domain) => !isFernManagedDomain(domain));

    // Only hide the card when the domain is fully verified (liveness check passed)
    if (domainInfo?.status === "VERIFIED") {
        return null;
    }

    // In-progress setup
    if (domainInfo) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    <ClockIcon className="size-4" />
                    <span className="font-medium">Custom domain setup ({domainInfo.domain})</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                    Continue Setup
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRemoveModal(true)}
                    className="text-muted-foreground hover:text-destructive"
                >
                    <TrashIcon className="size-4" />
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

    // Site already has a custom domain - show the current domain
    if (existingCustomDomain) {
        return (
            <div className="flex items-center gap-2 rounded-md bg-green-100 px-3 py-1.5 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircleIcon className="size-4" />
                <span className="font-medium">{existingCustomDomain}</span>
            </div>
        );
    }

    // No custom domain - show add button
    return (
        <>
            <Button variant="default" onClick={() => setShowAddModal(true)}>
                <GlobeIcon className="mr-2 size-4" />
                Add Custom Domain
            </Button>
            <AddCustomDomainModal
                open={showAddModal}
                onOpenChange={setShowAddModal}
                docsUrl={docsUrl}
                orgName={orgName}
            />
        </>
    );
}
