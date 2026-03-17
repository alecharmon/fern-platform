"use client";

import { CheckCircleIcon, InfoIcon, LoaderCircleIcon } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkSiteLiveness } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { useBackgroundPoller } from "@/hooks/useBackgroundPoller";
import type { DocsUrl } from "@/utils/types";

type LivenessState = "polling" | "live" | "timeout";

interface SetupCompleteContentProps {
    domain: string;
    isSubpathDomain: boolean;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    domainInfo: CustomDomainInfo;
    onDomainInfoChange: (info: CustomDomainInfo) => void;
    onSetupVerified: () => void;
}

export function SetupCompleteContent({
    domain,
    isSubpathDomain: _isSubpathDomain,
    docsUrl,
    orgName,
    domainInfo,
    onDomainInfoChange,
    onSetupVerified
}: SetupCompleteContentProps) {
    const posthog = usePostHog();
    const [livenessState, setLivenessState] = useState<LivenessState>("polling");
    const verifiedTimerRef = useRef<NodeJS.Timeout | null>(null);

    const checkFn = useCallback(async () => {
        const result = await checkSiteLiveness({ domain, docsUrl, orgName });
        if (result.live) {
            if (result.domainInfo) {
                onDomainInfoChange(result.domainInfo);
            }
            captureEvent(posthog, PosthogEventName.CUSTOM_DOMAIN_SITE_LIVE, {
                domain: domainInfo.domain || domain
            });
            setLivenessState("live");
            return true;
        }
        return false;
    }, [domain, docsUrl, orgName, onDomainInfoChange, posthog, domainInfo.domain]);

    const { isPolling } = useBackgroundPoller(checkFn, {
        autoStart: true,
        pollingInterval: 10_000,
        maxPollingTime: 10 * 60_000,
        refreshOnSuccess: false
    });

    // When polling stops without becoming live, it's a timeout
    useEffect(() => {
        if (!isPolling && livenessState === "polling") {
            setLivenessState("timeout");
            captureEvent(posthog, PosthogEventName.CUSTOM_DOMAIN_SITE_LIVENESS_TIMEOUT, {
                domain: domainInfo.domain || domain
            });
        }
    }, [isPolling, livenessState, posthog, domain, domainInfo.domain]);

    // When live, fire onSetupVerified after a brief delay so the user sees the success message
    useEffect(() => {
        if (livenessState === "live") {
            verifiedTimerRef.current = setTimeout(() => {
                onSetupVerified();
            }, 2000);
        }
        return () => {
            if (verifiedTimerRef.current) {
                clearTimeout(verifiedTimerRef.current);
            }
        };
    }, [livenessState, onSetupVerified]);

    if (livenessState === "live") {
        return (
            <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-start gap-3">
                    <CheckCircleIcon className="mt-0.5 size-5 text-green-600 dark:text-green-400" />
                    <div>
                        <p className="font-medium text-green-800 dark:text-green-200">Your site is live!</p>
                        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                            <strong>{domainInfo.domain || domain}</strong> is now serving your documentation.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (livenessState === "timeout") {
        return (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-start gap-3">
                    <InfoIcon className="mt-0.5 size-5 text-blue-600 dark:text-blue-400" />
                    <div>
                        <p className="font-medium text-blue-800 dark:text-blue-200">DNS propagation in progress</p>
                        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                            DNS changes can take up to 48 hours to propagate. Your setup is saved — check back later.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Polling state
    return (
        <div className="rounded-md border border-muted bg-muted/30 p-4">
            <div className="flex items-start gap-3">
                <LoaderCircleIcon className="mt-0.5 size-5 animate-spin text-muted-foreground" />
                <div>
                    <p className="font-medium">Checking if your site is live...</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        DNS changes can take a few minutes to propagate.
                    </p>
                </div>
            </div>
        </div>
    );
}
