"use client";

import { useCallback, useMemo, useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import { getDomainWithoutSubpath, getSubpath, hasSubpath } from "@/app/services/domain/validation";
import type { DocsUrl } from "@/utils/types";
import { ChecklistItem } from "./ChecklistItem";
import { ConfigureDnsContent } from "./ConfigureDnsContent";
import { ConfigureProxyContent } from "./ConfigureProxyContent";
import { SetupCompleteContent } from "./SetupCompleteContent";
import { type GitStatus, UpdateConfigContent } from "./UpdateConfigContent";
import { useDomainSetupState } from "./useDomainSetupState";
import { VerifyOwnershipContent } from "./VerifyOwnershipContent";

interface DomainSetupChecklistProps {
    domainInfo: CustomDomainInfo;
    domain: string;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    onDomainInfoChange: (info: CustomDomainInfo) => void;
    onSetupVerified: () => void;
}

export function DomainSetupChecklist({
    domainInfo,
    domain,
    docsUrl,
    orgName,
    onDomainInfoChange,
    onSetupVerified
}: DomainSetupChecklistProps) {
    const {
        state,
        isAllComplete,
        expandItem,
        handleOwnershipVerifying,
        handleOwnershipVerified,
        handleOwnershipFailed,
        handleConfigUpdated,
        handleDnsVerifying,
        handleDnsVerified,
        handleDnsFailed,
        handleProxyConfirming,
        handleProxyConfirmed,
        handleProxyFailed
    } = useDomainSetupState({
        ownershipVerified: domainInfo.ownershipVerified,
        configPublished: docsUrl === domainInfo.domain,
        dnsConfigured: domainInfo.dnsConfigured,
        prCreated: domainInfo.prUrl != null
    });

    // Lifted state so it persists across expand/collapse of the checklist item
    const [gitStatus, setGitStatus] = useState<GitStatus>({ checked: false, connected: false });
    const [prUrl, setPrUrl] = useState<string | null>(domainInfo.prUrl);

    const handleGitStatusChange = useCallback((status: GitStatus) => {
        setGitStatus(status);
    }, []);

    const handlePrCreated = useCallback((url: string) => {
        setPrUrl(url);
    }, []);

    const isSubpathDomain = useMemo(() => {
        return hasSubpath(domainInfo.domain || "") || hasSubpath(domain);
    }, [domainInfo.domain, domain]);

    const domainHostOnly = useMemo(() => {
        const domainToCheck = domainInfo.domain || domain;
        return domainToCheck ? getDomainWithoutSubpath(domainToCheck) : "";
    }, [domainInfo.domain, domain]);

    const subpath = useMemo(() => {
        const domainToCheck = domainInfo.domain || domain;
        return domainToCheck ? getSubpath(domainToCheck) : "";
    }, [domainInfo.domain, domain]);

    const onOwnershipVerified = useCallback(
        (updatedInfo: CustomDomainInfo) => {
            handleOwnershipVerified();
            onDomainInfoChange(updatedInfo);
        },
        [handleOwnershipVerified, onDomainInfoChange]
    );

    const onDnsVerifiedCb = useCallback(
        (updatedInfo: CustomDomainInfo) => {
            handleDnsVerified();
            onDomainInfoChange(updatedInfo);
        },
        [handleDnsVerified, onDomainInfoChange]
    );

    const onProxyConfirmedCb = useCallback(
        (updatedInfo: CustomDomainInfo) => {
            handleProxyConfirmed();
            onDomainInfoChange(updatedInfo);
        },
        [handleProxyConfirmed, onDomainInfoChange]
    );

    const dnsOrProxyTitle = isSubpathDomain ? "Configure reverse proxy" : "Configure DNS records";

    return (
        <div className="space-y-3">
            <ChecklistItem
                title="Verify domain ownership"
                status={state.ownership}
                expanded={state.expandedItem === "ownership"}
                onToggle={() => expandItem("ownership")}
            >
                <VerifyOwnershipContent
                    domainInfo={domainInfo}
                    domain={domain}
                    docsUrl={docsUrl}
                    orgName={orgName}
                    onVerified={onOwnershipVerified}
                    onFailed={handleOwnershipFailed}
                    onVerifying={handleOwnershipVerifying}
                    onDomainInfoChange={onDomainInfoChange}
                />
            </ChecklistItem>

            <ChecklistItem
                title="Update docs.yml configuration"
                status={state.config}
                expanded={state.expandedItem === "config"}
                onToggle={() => expandItem("config")}
            >
                <UpdateConfigContent
                    domainInfo={domainInfo}
                    docsUrl={docsUrl}
                    orgName={orgName}
                    isSubpathDomain={isSubpathDomain}
                    subpath={subpath}
                    onConfigUpdated={handleConfigUpdated}
                    gitStatus={gitStatus}
                    onGitStatusChange={handleGitStatusChange}
                    prUrl={prUrl}
                    onPrCreated={handlePrCreated}
                />
            </ChecklistItem>

            <ChecklistItem
                title={dnsOrProxyTitle}
                status={state.dnsOrProxy}
                lockedMessage="Verify ownership first"
                expanded={state.expandedItem === "dns-or-proxy"}
                onToggle={() => expandItem("dns-or-proxy")}
            >
                {isSubpathDomain ? (
                    <ConfigureProxyContent
                        domainInfo={domainInfo}
                        domain={domain}
                        domainHostOnly={domainHostOnly}
                        docsUrl={docsUrl}
                        orgName={orgName}
                        onProxyConfirmed={onProxyConfirmedCb}
                        onProxyFailed={handleProxyFailed}
                        onProxyConfirming={handleProxyConfirming}
                    />
                ) : (
                    <ConfigureDnsContent
                        domainInfo={domainInfo}
                        domain={domain}
                        docsUrl={docsUrl}
                        orgName={orgName}
                        onDnsVerified={onDnsVerifiedCb}
                        onDnsFailed={handleDnsFailed}
                        onDnsVerifying={handleDnsVerifying}
                    />
                )}
            </ChecklistItem>

            {isAllComplete && (
                <SetupCompleteContent
                    domain={domainInfo.domain || domain}
                    isSubpathDomain={isSubpathDomain}
                    docsUrl={docsUrl}
                    orgName={orgName}
                    domainInfo={domainInfo}
                    onDomainInfoChange={onDomainInfoChange}
                    onSetupVerified={onSetupVerified}
                />
            )}
        </div>
    );
}
