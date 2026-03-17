"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getDnsRecords, updateDomainChecklistStep } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo, VercelDnsRecord } from "@/app/services/domain";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../../ui/button";

interface ConfigureDnsContentProps {
    domainInfo: CustomDomainInfo;
    domain: string;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    onDnsVerified: (updatedDomainInfo: CustomDomainInfo) => void;
    onDnsFailed: () => void;
    onDnsVerifying: () => void;
}

export function ConfigureDnsContent({
    domainInfo,
    domain,
    docsUrl,
    orgName,
    onDnsVerified,
    onDnsFailed,
    onDnsVerifying
}: ConfigureDnsContentProps) {
    const posthog = usePostHog();
    const [dnsRecords, setDnsRecords] = useState<VercelDnsRecord[]>([]);
    const [loadingDnsRecords, setLoadingDnsRecords] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const domainToCheck = domainInfo.domain || domain;

    // Fetch DNS records on mount
    useEffect(() => {
        if (!domainToCheck) {
            return;
        }
        setLoadingDnsRecords(true);
        getDnsRecords({ domain: domainToCheck, orgName })
            .then((result) => {
                if (result.success && result.dnsRecords.length > 0) {
                    setDnsRecords(result.dnsRecords);
                }
            })
            .catch((err) => console.error("Failed to fetch DNS records:", err))
            .finally(() => setLoadingDnsRecords(false));
    }, [domainToCheck, orgName]);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${label} to clipboard`);
    };

    const handleVerifyDns = async () => {
        if (!domainToCheck) {
            return;
        }

        setIsVerifying(true);
        onDnsVerifying();

        const maxAttempts = 5;
        const pollInterval = 2000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const result = await getDnsRecords({ domain: domainToCheck, orgName });

                if (result.success && !result.misconfigured) {
                    const stepResult = await updateDomainChecklistStep({
                        docsUrl,
                        orgName,
                        updates: { dnsConfigured: true },
                        domain: domainInfo.domain || domain
                    });
                    captureEvent(posthog, PosthogEventName.CUSTOM_DOMAIN_DNS_VERIFIED, {
                        domain: domainToCheck
                    });
                    toast.success("DNS records verified! Your custom domain is fully configured.");
                    setIsVerifying(false);

                    if (stepResult.success && stepResult.domainInfo) {
                        onDnsVerified(stepResult.domainInfo);
                    }
                    return;
                }

                if (result.success && result.dnsRecords.length > 0) {
                    setDnsRecords(result.dnsRecords);
                }

                if (attempt < maxAttempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, pollInterval));
                }
            } catch (error) {
                console.error("Error checking DNS configuration:", error);
            }
        }

        setIsVerifying(false);
        captureEvent(posthog, PosthogEventName.CUSTOM_DOMAIN_DNS_VERIFICATION_FAILED, {
            domain: domainToCheck
        });
        onDnsFailed();
        toast.info("DNS records not yet detected. Please allow time for DNS propagation and try again.");
    };

    const recordsToShow: VercelDnsRecord[] =
        dnsRecords.length > 0 ? dnsRecords : [{ type: "CNAME", name: domainToCheck, value: "cname.vercel-dns.com" }];

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Add the following DNS records to your DNS provider to complete the setup:
            </p>

            {loadingDnsRecords ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    Loading DNS configuration...
                </div>
            ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                                <th className="px-4 py-2 font-medium">Type</th>
                                <th className="px-4 py-2 font-medium">Name</th>
                                <th className="px-4 py-2 font-medium">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recordsToShow.map((record, index) => (
                                <tr
                                    key={`${record.type}-${record.name}-${index}`}
                                    className="border-b border-border/50 last:border-0"
                                >
                                    <td
                                        className="px-4 py-3 font-mono text-xs cursor-pointer hover:bg-muted/50"
                                        onClick={() => copyToClipboard(record.type, "type")}
                                    >
                                        {record.type}
                                    </td>
                                    <td
                                        className="px-4 py-3 font-mono text-xs cursor-pointer hover:bg-muted/50"
                                        onClick={() => copyToClipboard(record.name, "name")}
                                    >
                                        {record.name}
                                    </td>
                                    <td
                                        className="px-4 py-3 font-mono text-xs break-all max-w-[300px] cursor-pointer hover:bg-muted/50"
                                        onClick={() => copyToClipboard(record.value, "value")}
                                    >
                                        {record.value}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                DNS changes may take up to 48 hours to propagate, but usually happen within a few minutes.
            </p>

            <Button variant="outline" onClick={handleVerifyDns} disabled={isVerifying} className="w-full">
                <RefreshCwIcon className={`mr-2 size-4 ${isVerifying ? "animate-spin" : ""}`} />
                Check DNS Status
            </Button>
        </div>
    );
}
