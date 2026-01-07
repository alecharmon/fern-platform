"use client";

import { CheckCircleIcon, ClockIcon, CopyIcon, GlobeIcon, Loader2Icon, RefreshCwIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getDnsRecords } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo, VercelDnsRecord } from "@/app/services/domain";
import { getDomainWithoutSubpath } from "@/app/services/domain/validation";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { CopyableText } from "../ui/CopyableText";
import { AddCustomDomainModal } from "./AddCustomDomainModal";
import { RemoveCustomDomainModal } from "./RemoveCustomDomainModal";

interface CustomDomainCardProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    domainInfo?: CustomDomainInfo;
    allDomains?: string[];
}

// Check if a domain is a Fern-managed domain (*.docs.buildwithfern.com)
function isFernManagedDomain(domain: string): boolean {
    return domain.endsWith(".docs.buildwithfern.com");
}

export function CustomDomainCard({ docsUrl, orgName, domainInfo, allDomains = [] }: CustomDomainCardProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [dnsRecords, setDnsRecords] = useState<VercelDnsRecord[]>([]);
    const [loadingDns, setLoadingDns] = useState(false);

    // Check if any domain is a custom domain (not a *.docs.buildwithfern.com domain)
    const existingCustomDomain = allDomains.find((domain) => !isFernManagedDomain(domain));

    const fetchDnsConfig = useCallback(() => {
        if (domainInfo?.domain) {
            setLoadingDns(true);
            getDnsRecords({ domain: domainInfo.domain, orgName })
                .then((result) => {
                    if (result.success) {
                        setDnsRecords(result.dnsRecords);
                    }
                })
                .finally(() => setLoadingDns(false));
        }
    }, [domainInfo?.domain, orgName]);

    // Fetch DNS records when on verify-dns step
    useEffect(() => {
        if (domainInfo?.setupStep === "verify-dns" && domainInfo.domain) {
            fetchDnsConfig();
        }
    }, [domainInfo?.setupStep, domainInfo?.domain, fetchDnsConfig]);

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const { setupStep } = domainInfo ?? {};
    const isComplete = setupStep === "complete";
    const needsProxyConfig = setupStep === "configure-proxy";
    const needsDnsConfig = setupStep === "verify-dns";

    // Setup complete - show green badge only
    if (domainInfo && isComplete) {
        return (
            <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-md bg-green-100 px-3 py-1.5 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircleIcon className="size-4" />
                        <span className="font-medium">{domainInfo.domain}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRemoveModal(true)}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <TrashIcon className="size-4" />
                    </Button>
                </div>
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

    // Needs proxy configuration (subpath domains)
    if (domainInfo && needsProxyConfig) {
        const domainHostOnly = getDomainWithoutSubpath(domainInfo.domain);

        return (
            <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        <ClockIcon className="size-4" />
                        <span className="font-medium">{domainInfo.domain}</span>
                        <span className="text-amber-600 dark:text-amber-500">(proxy setup required)</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRemoveModal(true)}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <TrashIcon className="size-4" />
                    </Button>
                </div>

                <div className="w-full rounded-md border border-border bg-muted/30 p-4">
                    <p className="mb-3 text-sm text-muted-foreground">
                        Configure a reverse proxy on your server to forward requests to Fern:
                    </p>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Proxy target</p>
                            <CopyableText text="https://app.buildwithfern.com" successMessage="Copied!" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Required header</p>
                            <CopyableText text={`X-Fern-Host: ${domainHostOnly}`} successMessage="Copied!" />
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Forward all requests from <code className="rounded bg-muted px-1">{domainInfo.domain}</code> to
                        the proxy target with the header above.
                    </p>
                </div>

                <Button variant="outline" onClick={() => setShowAddModal(true)}>
                    Complete Setup
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

    // Needs DNS configuration (regular domains)
    if (domainInfo && needsDnsConfig) {
        return (
            <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        <ClockIcon className="size-4" />
                        <span className="font-medium">{domainInfo.domain}</span>
                        <span className="text-amber-600 dark:text-amber-500">(DNS setup required)</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRemoveModal(true)}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <TrashIcon className="size-4" />
                    </Button>
                </div>

                <div className="w-full rounded-md border border-border bg-muted/30 p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Add these DNS records to your DNS provider:</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchDnsConfig}
                            disabled={loadingDns}
                            className="text-muted-foreground"
                        >
                            <RefreshCwIcon className={`size-4 ${loadingDns ? "animate-spin" : ""}`} />
                            <span className="ml-1">Refresh</span>
                        </Button>
                    </div>
                    {loadingDns ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                            Loading DNS configuration...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-muted-foreground">
                                        <th className="pb-2 pr-4 font-medium">Type</th>
                                        <th className="pb-2 pr-4 font-medium">Name</th>
                                        <th className="pb-2 pr-4 font-medium">Value</th>
                                        <th className="pb-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dnsRecords.map((record, index) => (
                                        <tr
                                            key={`${record.type}-${record.name}-${index}`}
                                            className="border-b border-border/50 last:border-0"
                                        >
                                            <td className="py-2 pr-4 font-mono">{record.type}</td>
                                            <td className="py-2 pr-4 font-mono">{record.name}</td>
                                            <td className="py-2 pr-4 font-mono break-all">{record.value}</td>
                                            <td className="py-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(record.value, `record-${index}`)}
                                                    className="text-muted-foreground h-8 w-8 p-0"
                                                >
                                                    {copiedField === `record-${index}` ? (
                                                        <CheckCircleIcon className="size-4 text-green-500" />
                                                    ) : (
                                                        <CopyIcon className="size-4" />
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <Button variant="outline" onClick={() => setShowAddModal(true)}>
                    Verify DNS
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

    // Pending verification or earlier steps
    if (domainInfo) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-md bg-yellow-100 px-3 py-1.5 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <ClockIcon className="size-4" />
                    <span className="font-medium">{domainInfo.domain}</span>
                    <span className="text-yellow-600 dark:text-yellow-500">(pending)</span>
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
