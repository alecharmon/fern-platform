"use client";

import { CheckCircleIcon, CircleDashedIcon, ClockIcon, SettingsIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import type { DocsUrl } from "@/utils/types";
import { docsPermissionScope } from "../auth/authz";
import { AuthZButton } from "../auth/authz/AuthZButton";
import { AddCustomDomainModal } from "../settings/AddCustomDomainModal";
import { RemoveCustomDomainModal } from "../settings/RemoveCustomDomainModal";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/button";

interface CustomDomainButtonProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    domainInfo?: CustomDomainInfo;
    allDomains?: string[];
}

// Check if a domain is a Fern-managed domain (*.docs.buildwithfern.com)
function isFernManagedDomain(domain: string): boolean {
    return domain.endsWith(".docs.buildwithfern.com");
}

export function CustomDomainButton({ docsUrl, orgName, domainInfo, allDomains = [] }: CustomDomainButtonProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRemoveModal, setShowRemoveModal] = useState(false);

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
                    onClick={() => setShowAddModal(true)}
                    className="text-green-1100 hover:bg-green-200 hover:text-green-1100 w-fit -ml-1"
                >
                    <CircleDashedIcon className="size-3.5 " />
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

    const { setupStep } = domainInfo;
    const isComplete = setupStep === "complete";
    const needsConfig = setupStep === "configure-proxy" || setupStep === "verify-dns";
    const configLabel = setupStep === "configure-proxy" ? "Proxy Config" : "Configure DNS";

    // Setup complete - just show green badge
    if (isComplete) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircleIcon className="size-3" />
                    <span>{domainInfo.domain}</span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRemoveModal(true)}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                >
                    <TrashIcon className="size-3.5" />
                </Button>
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

    // Needs configuration (proxy or DNS)
    if (needsConfig) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    <ClockIcon className="size-3" />
                    <span>{domainInfo.domain}</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(true)}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <SettingsIcon className="mr-1.5 size-3.5" />
                    {configLabel}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRemoveModal(true)}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
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

    // Earlier steps (pending verification, etc.) - show continue setup
    return (
        <div className="flex items-center gap-2">
            <button onClick={() => setShowAddModal(true)} className="cursor-pointer">
                <Badge variant="success">
                    <ClockIcon className="size-3" /> {domainInfo.domain} (pending)
                </Badge>
            </button>
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
