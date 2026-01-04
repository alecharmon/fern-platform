"use client";

import { CheckCircleIcon, ClockIcon, GlobeIcon, PlusIcon, SettingsIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getDnsRecords } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo, VercelDnsRecord } from "@/app/services/domain";
import { getDomainWithoutSubpath, hasSubpath } from "@/app/services/domain/validation";
import type { DocsUrl } from "@/utils/types";
import { AddCustomDomainModal } from "../settings/AddCustomDomainModal";
import { RemoveCustomDomainModal } from "../settings/RemoveCustomDomainModal";
import { Button } from "../ui/button";
import { DnsRecordsModal } from "./DnsRecordsModal";
import { ProxyConfigModal } from "./ProxyConfigModal";

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
    const [showDnsModal, setShowDnsModal] = useState(false);
    const [showProxyModal, setShowProxyModal] = useState(false);
    const [dnsRecords, setDnsRecords] = useState<VercelDnsRecord[]>([]);
    const [loadingDns, setLoadingDns] = useState(false);
    const [isMisconfigured, setIsMisconfigured] = useState(true);

    // Check if this is a subpath domain (e.g., example.com/docs)
    const isSubpathDomain = useMemo(() => {
        return domainInfo?.domain ? hasSubpath(domainInfo.domain) : false;
    }, [domainInfo?.domain]);

    const domainHostOnly = useMemo(() => {
        return domainInfo?.domain ? getDomainWithoutSubpath(domainInfo.domain) : "";
    }, [domainInfo?.domain]);

    const fetchDnsConfig = useCallback(() => {
        if (domainInfo?.domain) {
            setLoadingDns(true);
            getDnsRecords({ domain: domainInfo.domain, orgName })
                .then((result) => {
                    if (result.success) {
                        setDnsRecords(result.dnsRecords);
                        setIsMisconfigured(result.misconfigured);
                    }
                })
                .finally(() => setLoadingDns(false));
        }
    }, [domainInfo?.domain, orgName]);

    // Fetch DNS records when domain is verified (skip for subpath domains - they use reverse proxy)
    useEffect(() => {
        if (domainInfo?.status === "VERIFIED" && domainInfo.domain && !isSubpathDomain) {
            fetchDnsConfig();
        }
    }, [domainInfo?.status, domainInfo?.domain, fetchDnsConfig, isSubpathDomain]);

    // Check if any domain is already a custom domain (not *.docs.buildwithfern.com)
    const existingCustomDomain = allDomains.find((domain) => !isFernManagedDomain(domain));

    // No domainInfo and no existing custom domain - show add button
    if (!domainInfo) {
        // If there's already a custom domain in the URLs, don't show the add button
        if (existingCustomDomain) {
            return null;
        }

        return (
            <>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(true)}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <PlusIcon className="mr-1.5 size-3.5" />
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

    // Pending verification
    if (domainInfo.status === "PENDING") {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <ClockIcon className="size-3" />
                    <span>{domainInfo.domain}</span>
                    <span className="text-yellow-600 dark:text-yellow-500">(pending)</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                    Continue Setup
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

    // Verified - show domain with status
    // For subpath domains, we don't check DNS - user configures their own reverse proxy
    const isFullyConfigured = isSubpathDomain || (!loadingDns && !isMisconfigured);

    if (isFullyConfigured) {
        // Fully configured - show green badge
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircleIcon className="size-3" />
                    <span>{domainInfo.domain}</span>
                </div>
                {isSubpathDomain && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowProxyModal(true)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <SettingsIcon className="mr-1.5 size-3.5" />
                        Proxy Config
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRemoveModal(true)}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                >
                    <TrashIcon className="size-3.5" />
                </Button>
                {isSubpathDomain && (
                    <ProxyConfigModal
                        open={showProxyModal}
                        onOpenChange={setShowProxyModal}
                        domain={domainInfo.domain}
                        domainHostOnly={domainHostOnly}
                    />
                )}
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

    // Verified but DNS not configured - show amber badge with configure button
    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <GlobeIcon className="size-3" />
                <span>{domainInfo.domain}</span>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDnsModal(true)}
                className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
            >
                <SettingsIcon className="mr-1.5 size-3.5" />
                Configure DNS
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRemoveModal(true)}
                className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
            >
                <TrashIcon className="size-3.5" />
            </Button>
            <DnsRecordsModal
                open={showDnsModal}
                onOpenChange={setShowDnsModal}
                domain={domainInfo.domain}
                dnsRecords={dnsRecords}
                loading={loadingDns}
                onRefresh={fetchDnsConfig}
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
