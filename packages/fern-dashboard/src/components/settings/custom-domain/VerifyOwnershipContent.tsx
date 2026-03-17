"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";

import { initiateCustomDomain, updateDomainChecklistStep, verifyCustomDomain } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../../ui/button";

interface VerifyOwnershipContentProps {
    domainInfo: CustomDomainInfo;
    domain: string;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    onVerified: (updatedDomainInfo: CustomDomainInfo) => void;
    onFailed: () => void;
    onVerifying: () => void;
    onDomainInfoChange: (updatedDomainInfo: CustomDomainInfo) => void;
}

export function VerifyOwnershipContent({
    domainInfo,
    domain,
    docsUrl,
    orgName,
    onVerified,
    onFailed,
    onVerifying,
    onDomainInfoChange
}: VerifyOwnershipContentProps) {
    const router = useRouter();
    const posthog = usePostHog();
    const [isLoading, setIsLoading] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isExpired = new Date(domainInfo.expiresAt).getTime() < Date.now();

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${label} to clipboard`);
    };

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        setError(null);

        try {
            const result = await initiateCustomDomain({
                domain: domainInfo.domain || domain,
                docsUrl,
                orgName
            });

            if (!result.success) {
                setError(result.error || "Failed to regenerate verification token.");
                return;
            }

            if (result.domainInfo) {
                onDomainInfoChange(result.domainInfo);
                router.refresh();
                toast.success("New verification token generated. Please update your TXT record.");
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleVerify = async () => {
        setIsLoading(true);
        setError(null);
        onVerifying();

        try {
            const result = await verifyCustomDomain({
                docsUrl,
                orgName,
                domain: domainInfo.domain || domain
            });

            if (result.requiresCheckout) {
                captureEvent(posthog, PosthogEventName.CUSTOM_DOMAIN_OWNERSHIP_VERIFICATION_FAILED, {
                    domain: domainInfo.domain || domain,
                    error: "requires_checkout"
                });
                toast.info("Custom domains require a paid plan. Checkout coming soon!");
                setIsLoading(false);
                onFailed();
                return;
            }

            if (!result.verified) {
                const errorMsg = result.error || "DNS verification failed. Please check your DNS settings.";
                setError(errorMsg);
                captureEvent(posthog, PosthogEventName.CUSTOM_DOMAIN_OWNERSHIP_VERIFICATION_FAILED, {
                    domain: domainInfo.domain || domain,
                    error: errorMsg
                });
                // If a new token was issued (e.g. expired), update the displayed TXT record
                if (result.domainInfo) {
                    onDomainInfoChange(result.domainInfo);
                }
                setIsLoading(false);
                onFailed();
                return;
            }

            if (!result.success) {
                const errorMsg = result.error || "Failed to add domain to Vercel.";
                setError(errorMsg);
                captureEvent(posthog, PosthogEventName.CUSTOM_DOMAIN_OWNERSHIP_VERIFICATION_FAILED, {
                    domain: domainInfo.domain || domain,
                    error: errorMsg
                });
                setIsLoading(false);
                onFailed();
                return;
            }

            captureEvent(posthog, PosthogEventName.CUSTOM_DOMAIN_OWNERSHIP_VERIFIED, {
                domain: domainInfo.domain || domain
            });
            toast.success(`Domain ownership verified for ${domain}!`);

            const stepResult = await updateDomainChecklistStep({
                docsUrl,
                orgName,
                updates: { ownershipVerified: true },
                domain: domainInfo.domain || domain
            });
            const updatedInfo = stepResult.success ? stepResult.domainInfo : result.domainInfo;

            if (updatedInfo) {
                onVerified(updatedInfo);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
            onFailed();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Add the following TXT record to your DNS provider to verify domain ownership:
            </p>

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
                        <tr className="border-b border-border/50 last:border-0">
                            <td
                                className={`px-4 py-3 font-mono text-xs cursor-pointer hover:bg-muted/50 ${isExpired ? "line-through text-muted-foreground" : ""}`}
                                onClick={() => copyToClipboard("TXT", "type")}
                            >
                                TXT
                            </td>
                            <td
                                className={`px-4 py-3 font-mono text-xs cursor-pointer hover:bg-muted/50 ${isExpired ? "line-through text-muted-foreground" : ""}`}
                                onClick={() => copyToClipboard(domainInfo.verificationRecord.host, "name")}
                            >
                                {domainInfo.verificationRecord.host}
                            </td>
                            <td
                                className={`px-4 py-3 font-mono text-xs break-all max-w-[300px] cursor-pointer hover:bg-muted/50 ${isExpired ? "line-through text-muted-foreground" : ""}`}
                                onClick={() => copyToClipboard(domainInfo.verificationRecord.value, "value")}
                            >
                                {domainInfo.verificationRecord.value}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {isExpired ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <p className="font-medium">Verification token expired</p>
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">
                        Generate a new token and update your TXT record to continue.
                    </p>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">
                    DNS changes may take up to 48 hours to propagate, but usually happen within a few minutes.
                </p>
            )}

            {error && <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>}

            {isExpired ? (
                <Button onClick={handleRegenerate} loading={isRegenerating} className="w-full">
                    Regenerate Token
                </Button>
            ) : (
                <Button onClick={handleVerify} loading={isLoading} className="w-full">
                    Verify Ownership
                </Button>
            )}
        </div>
    );
}
