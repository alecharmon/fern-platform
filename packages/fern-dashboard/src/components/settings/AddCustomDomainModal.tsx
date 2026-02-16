"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { initiateCustomDomain } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import { hasSubpath } from "@/app/services/domain/validation";
import { useEntitlement } from "@/state/useEntitlement";
import type { DocsUrl } from "@/utils/types";
import { cn } from "@/utils/utils";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { DomainSetupChecklist } from "./custom-domain/DomainSetupChecklist";

type ModalPhase = "enter-domain" | "checklist";

interface AddCustomDomainModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    existingDomainInfo?: CustomDomainInfo;
}

export function AddCustomDomainModal({
    open,
    onOpenChange,
    docsUrl,
    orgName,
    existingDomainInfo
}: AddCustomDomainModalProps) {
    const router = useRouter();
    const { isEntitled: canUseSubpath } = useEntitlement("custom_domain_subpath");
    const [phase, setPhase] = useState<ModalPhase>(existingDomainInfo ? "checklist" : "enter-domain");
    const [domain, setDomain] = useState(existingDomainInfo?.domain || "");
    const [domainInfo, setDomainInfo] = useState<CustomDomainInfo | undefined>(existingDomainInfo);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showUpgradeLink, setShowUpgradeLink] = useState(false);

    const hasInitializedRef = useRef(false);

    // Reset state when modal opens
    useEffect(() => {
        if (!open) {
            hasInitializedRef.current = false;
            return;
        }

        if (hasInitializedRef.current) {
            return;
        }

        hasInitializedRef.current = true;
        setError(null);

        if (existingDomainInfo) {
            setDomain(existingDomainInfo.domain || "");
            setDomainInfo(existingDomainInfo);
            setPhase("checklist");
        } else {
            setPhase("enter-domain");
            setDomain("");
            setDomainInfo(undefined);
        }
    }, [open, existingDomainInfo]);

    const handleInitiate = async () => {
        setIsLoading(true);
        setError(null);
        setShowUpgradeLink(false);

        const trimmedDomain = domain.trim().toLowerCase();
        if (hasSubpath(trimmedDomain) && !canUseSubpath) {
            setError("Custom subpath domains require a Pro plan.");
            setShowUpgradeLink(true);
            setIsLoading(false);
            return;
        }

        try {
            const result = await initiateCustomDomain({
                domain: domain.trim().toLowerCase(),
                docsUrl,
                orgName
            });

            if (!result.success) {
                setError(result.error || "Failed to initiate domain verification.");
                if (result.requiresUpgrade) {
                    setShowUpgradeLink(true);
                }
                return;
            }

            setDomainInfo(result.domainInfo);
            setPhase("checklist");
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDomainInfoChange = useCallback((info: CustomDomainInfo) => {
        setDomainInfo(info);
    }, []);

    const handleSetupVerified = useCallback(() => {
        onOpenChange(false);
        router.refresh();
    }, [onOpenChange, router]);

    const handleClose = () => {
        const domainWasInitiated = domainInfo && !existingDomainInfo;
        const statusChanged = domainInfo?.status !== existingDomainInfo?.status;
        const ownershipChanged = domainInfo?.ownershipVerified !== existingDomainInfo?.ownershipVerified;
        const dnsChanged = domainInfo?.dnsConfigured !== existingDomainInfo?.dnsConfigured;
        const shouldRefresh = domainWasInitiated || statusChanged || ownershipChanged || dnsChanged;

        onOpenChange(false);

        if (shouldRefresh) {
            router.refresh();
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!isLoading) {
            if (!newOpen) {
                handleClose();
            } else {
                onOpenChange(newOpen);
            }
        }
    };

    const title = phase === "enter-domain" ? "Add Custom Domain" : `Set up ${domainInfo?.domain || domain}`;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className={cn(
                    "mx-auto w-[calc(100%-2rem)] sm:max-w-[700px]",
                    phase === "checklist" && "sm:min-h-[640px]"
                )}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <DialogBody>
                    {phase === "enter-domain" && (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3">
                                <p className="text-muted-foreground text-sm">
                                    Enter the domain you want to use for your documentation.
                                </p>
                                <Input
                                    id="domain"
                                    placeholder="docs.example.com"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    disabled={isLoading}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            void handleInitiate();
                                        }
                                    }}
                                />
                            </div>

                            {error && (
                                <div className="bg-destructive/10 text-destructive flex items-center justify-between rounded-md p-3 text-sm">
                                    <span>{error}</span>
                                    {showUpgradeLink && (
                                        <Button variant="destructive" size="sm" asChild className="group">
                                            <Link href={`/${orgName}/billing`}>
                                                Upgrade
                                                <ArrowRight className="ml-0.5 h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:translate-x-0.5" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {phase === "checklist" && domainInfo && (
                        <DomainSetupChecklist
                            domainInfo={domainInfo}
                            domain={domain}
                            docsUrl={docsUrl}
                            orgName={orgName}
                            onDomainInfoChange={handleDomainInfoChange}
                            onSetupVerified={handleSetupVerified}
                        />
                    )}
                </DialogBody>

                <DialogFooter>
                    {phase === "enter-domain" && (
                        <>
                            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button onClick={handleInitiate} disabled={!domain.trim() || isLoading} loading={isLoading}>
                                Continue
                            </Button>
                        </>
                    )}

                    {phase === "checklist" && <Button onClick={handleClose}>Done</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
