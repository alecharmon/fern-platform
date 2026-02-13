"use client";

import { useState } from "react";
import { toast } from "sonner";

import { updateDomainChecklistStep } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../../ui/button";
import { CopyableText } from "../../ui/CopyableText";

interface ConfigureProxyContentProps {
    domainInfo: CustomDomainInfo;
    domain: string;
    domainHostOnly: string;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    onProxyConfirmed: (updatedDomainInfo: CustomDomainInfo) => void;
    onProxyFailed: () => void;
    onProxyConfirming: () => void;
}

export function ConfigureProxyContent({
    domainInfo,
    domain,
    domainHostOnly,
    docsUrl,
    orgName,
    onProxyConfirmed,
    onProxyFailed,
    onProxyConfirming
}: ConfigureProxyContentProps) {
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirmProxy = async () => {
        setIsConfirming(true);
        setError(null);
        onProxyConfirming();

        try {
            const result = await updateDomainChecklistStep({
                docsUrl,
                orgName,
                updates: { dnsConfigured: true },
                domain: domainInfo.domain || domain
            });

            if (!result.success) {
                setError(result.error || "Failed to confirm proxy setup.");
                onProxyFailed();
                return;
            }

            toast.success("Reverse proxy configuration confirmed!");
            if (result.domainInfo) {
                onProxyConfirmed(result.domainInfo);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
            onProxyFailed();
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Configure a reverse proxy on your server to forward requests from{" "}
                <code className="rounded bg-muted px-1">{domainInfo.domain || domain}</code> to Fern.
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

            <p className="text-xs text-muted-foreground">
                Forward all requests from <code className="rounded bg-muted px-1">{domainInfo.domain || domain}</code>{" "}
                to the proxy target with the header above.
            </p>

            {error && <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>}

            <Button onClick={handleConfirmProxy} loading={isConfirming} className="w-full">
                Confirm Setup Complete
            </Button>
        </div>
    );
}
