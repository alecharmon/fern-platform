"use client";

import { CheckCircleIcon, ExternalLinkIcon, GitMergeIcon, GitPullRequestIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createCustomDomainPr, initiateCustomDomain, verifyCustomDomain } from "@/app/actions/customDomain";
import { type GitProvider, getGitConnectionStatus } from "@/app/actions/customDomain/getGitConnectionStatus";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo } from "@/app/services/domain";
import { getDomainWithoutSubpath, getSubpath, hasSubpath } from "@/app/services/domain/validation";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { CopyableText } from "../ui/CopyableText";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type ModalStep = "enter-domain" | "update-config" | "verify-dns" | "complete";

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
    const [step, setStep] = useState<ModalStep>(existingDomainInfo ? "verify-dns" : "enter-domain");
    const [domain, setDomain] = useState(existingDomainInfo?.domain || "");
    const [domainInfo, setDomainInfo] = useState<CustomDomainInfo | undefined>(existingDomainInfo);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Git repo connection state (supports GitHub and GitLab)
    const [gitStatus, setGitStatus] = useState<{
        checked: boolean;
        connected: boolean;
        provider?: GitProvider;
        gitUrl?: string;
        baseBranch?: string;
    }>({ checked: false, connected: false });
    const [isCreatingPr, setIsCreatingPr] = useState(false);
    const [prUrl, setPrUrl] = useState<string | null>(null);

    // Helper to get terminology based on provider
    const prTerminology = gitStatus.provider === "gitlab" ? "Merge Request" : "Pull Request";
    const prShortTerminology = gitStatus.provider === "gitlab" ? "MR" : "PR";
    const PrIcon = gitStatus.provider === "gitlab" ? GitMergeIcon : GitPullRequestIcon;

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            // Reset to appropriate initial state when modal opens
            if (existingDomainInfo) {
                setStep("verify-dns");
                setDomain(existingDomainInfo.domain || "");
                setDomainInfo(existingDomainInfo);
            } else {
                setStep("enter-domain");
                setDomain("");
                setDomainInfo(undefined);
            }
            setError(null);
            setGitStatus({ checked: false, connected: false });
            setPrUrl(null);
        }
    }, [open, existingDomainInfo]);

    // Check if the domain has a subpath (e.g., example.com/docs)
    const isSubpathDomain = useMemo(() => {
        const domainToCheck = domainInfo?.domain || domain;
        return domainToCheck ? hasSubpath(domainToCheck) : false;
    }, [domainInfo?.domain, domain]);

    const domainHostOnly = useMemo(() => {
        const domainToCheck = domainInfo?.domain || domain;
        return domainToCheck ? getDomainWithoutSubpath(domainToCheck) : "";
    }, [domainInfo?.domain, domain]);

    const subpath = useMemo(() => {
        const domainToCheck = domainInfo?.domain || domain;
        return domainToCheck ? getSubpath(domainToCheck) : "";
    }, [domainInfo?.domain, domain]);

    // Check git connection status (supports GitHub and GitLab)
    const checkGitStatus = useCallback(async () => {
        if (gitStatus.checked) {
            return;
        }

        const timeoutPromise = new Promise<{ connected: false }>((resolve) =>
            setTimeout(() => resolve({ connected: false }), 5000)
        );

        const gitPromise = getGitConnectionStatus({ docsUrl, orgName });

        const gitResult = await Promise.race([gitPromise, timeoutPromise]);
        setGitStatus({
            checked: true,
            connected: gitResult.connected,
            provider: "provider" in gitResult ? gitResult.provider : undefined,
            gitUrl: "gitUrl" in gitResult ? gitResult.gitUrl : undefined,
            baseBranch: "baseBranch" in gitResult ? gitResult.baseBranch : undefined
        });
    }, [docsUrl, orgName, gitStatus.checked]);

    // Re-check git status when entering the update-config step
    useEffect(() => {
        if (open && step === "update-config" && !gitStatus.checked) {
            checkGitStatus();
        }
    }, [open, step, gitStatus.checked, checkGitStatus]);

    const handleCreatePr = async () => {
        if (!gitStatus.connected || !gitStatus.gitUrl || !domainInfo) {
            return;
        }

        setIsCreatingPr(true);
        try {
            const result = await createCustomDomainPr({
                orgName,
                docsUrl,
                gitUrl: gitStatus.gitUrl,
                customDomain: domainInfo.domain,
                baseBranch: gitStatus.baseBranch ?? "main"
            });

            if (result.success && result.prUrl) {
                setPrUrl(result.prUrl);
                toast.success(`${prTerminology} created successfully!`);
            } else {
                toast.error(result.error ?? `Failed to create ${prTerminology.toLowerCase()}`);
            }
        } catch (err) {
            console.error(`Failed to create ${prShortTerminology}:`, err);
            toast.error(`Failed to create ${prTerminology.toLowerCase()}`);
        } finally {
            setIsCreatingPr(false);
        }
    };

    const handleInitiate = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // First, initiate the custom domain
            const result = await initiateCustomDomain({
                domain: domain.trim().toLowerCase(),
                docsUrl,
                orgName
            });

            if (!result.success) {
                setError(result.error || "Failed to initiate domain verification.");
                return;
            }

            setDomainInfo(result.domainInfo);

            // Go to update-config step - the useEffect will trigger GitHub check
            setStep("update-config");
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await verifyCustomDomain({
                docsUrl,
                orgName
            });

            if (result.requiresCheckout) {
                toast.info("Custom domains require a paid plan. Checkout coming soon!");
                return;
            }

            if (!result.verified) {
                setError(result.error || "DNS verification failed. Please check your DNS settings.");
                return;
            }

            if (!result.success) {
                setError(result.error || "Failed to add domain to Vercel.");
                return;
            }

            setDomainInfo(result.domainInfo);
            setStep("complete");
            toast.success(`${domain} has been added successfully!`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        // If a domain was initiated during this session, refresh the page to show the new state
        const shouldRefresh = domainInfo && !existingDomainInfo;

        onOpenChange(false);
        // State reset is handled by the useEffect when modal reopens

        if (shouldRefresh) {
            router.refresh();
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!isLoading && !isCreatingPr) {
            if (!newOpen) {
                handleClose();
            } else {
                onOpenChange(newOpen);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="mx-auto w-[calc(100%-2rem)] sm:max-w-[600px] md:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>
                        {step === "enter-domain" && "Add Custom Domain"}
                        {step === "update-config" && "Update Documentation Config"}
                        {step === "verify-dns" && "Verify Domain Ownership"}
                        {step === "complete" && "Domain Added"}
                    </DialogTitle>
                </DialogHeader>

                <DialogBody>
                    {step === "enter-domain" && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="domain">Domain</Label>
                                <Input
                                    id="domain"
                                    placeholder="docs.example.com"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    disabled={isLoading}
                                />
                                <p className="text-muted-foreground text-sm">
                                    Enter the domain you want to use for your documentation.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === "update-config" && domainInfo && (
                        <div className="space-y-4">
                            <p className="text-muted-foreground text-sm">
                                To use <strong>{domainInfo.domain}</strong> as your custom domain, you need to update
                                your <code className="rounded bg-muted px-1">docs.yml</code> configuration.
                            </p>

                            {/* Loading state while checking repository connection */}
                            {!gitStatus.checked && (
                                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                                    <Loader2Icon className="size-4 animate-spin" />
                                    Checking repository connection...
                                </div>
                            )}

                            {/* Repository connected - show PR/MR option */}
                            {gitStatus.checked && gitStatus.connected && !prUrl && (
                                <div className="space-y-4">
                                    <div className="rounded-md border border-border bg-muted/30 p-4">
                                        <div className="flex items-start gap-3">
                                            <PrIcon className="mt-0.5 size-5 text-muted-foreground" />
                                            <div className="space-y-1">
                                                <p className="font-medium">Create a {prTerminology}</p>
                                                <p className="text-muted-foreground text-sm">
                                                    {isSubpathDomain ? (
                                                        <>
                                                            We&apos;ll create a {prShortTerminology} that updates the{" "}
                                                            <code className="rounded bg-muted px-1">url</code> field and
                                                            adds the{" "}
                                                            <code className="rounded bg-muted px-1">custom-domain</code>{" "}
                                                            field to your docs.yml file.
                                                        </>
                                                    ) : (
                                                        <>
                                                            We&apos;ll create a {prShortTerminology} that adds the{" "}
                                                            <code className="rounded bg-muted px-1">custom-domain</code>{" "}
                                                            field to your docs.yml file.
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleCreatePr}
                                        disabled={isCreatingPr}
                                        loading={isCreatingPr}
                                        className="w-full"
                                    >
                                        <PrIcon className="mr-2 size-4" />
                                        Create {prTerminology}
                                    </Button>
                                </div>
                            )}

                            {/* PR/MR created - show success */}
                            {gitStatus.checked && gitStatus.connected && prUrl && (
                                <div className="space-y-4">
                                    <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                                        <div className="flex items-start gap-3">
                                            <CheckCircleIcon className="mt-0.5 size-5 text-green-600 dark:text-green-400" />
                                            <div className="space-y-2">
                                                <p className="font-medium text-green-800 dark:text-green-200">
                                                    {prTerminology} Created
                                                </p>
                                                <p className="text-green-700 text-sm dark:text-green-300">
                                                    Please review and merge the {prShortTerminology}, then click
                                                    &quot;Continue&quot;.
                                                </p>
                                                <a
                                                    href={prUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-sm font-medium text-green-700 underline hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
                                                >
                                                    View {prTerminology}
                                                    <ExternalLinkIcon className="size-3" />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Repository not connected - show manual instructions */}
                            {gitStatus.checked && !gitStatus.connected && (
                                <div className="space-y-3">
                                    <p className="text-muted-foreground text-sm">
                                        The instance field in your{" "}
                                        <code className="rounded bg-muted px-1">docs.yml</code> file should reflect the
                                        following:
                                    </p>
                                    <div className="rounded-md border border-border bg-muted/50 p-3 font-mono text-sm">
                                        <div className="text-muted-foreground">instances:</div>
                                        {isSubpathDomain ? (
                                            <div className="ml-4 space-y-0">
                                                <div>
                                                    <span className="text-muted-foreground">- url:</span>{" "}
                                                    <span className="text-foreground">
                                                        {docsUrl}
                                                        <strong>{subpath}</strong>
                                                    </span>
                                                </div>
                                                <div className="ml-4 font-semibold">
                                                    <span className="text-muted-foreground">custom-domain:</span>{" "}
                                                    <span className="text-foreground">{domainInfo.domain}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="ml-4 space-y-0">
                                                <div>
                                                    <span className="text-muted-foreground">- url:</span>{" "}
                                                    <span className="text-foreground">{docsUrl}</span>
                                                </div>
                                                <div className="ml-4">
                                                    <span className="text-muted-foreground">custom-domain:</span>{" "}
                                                    <span className="text-foreground">{domainInfo.domain}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        After updating your docs.yml, commit and push the changes before continuing.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === "verify-dns" && domainInfo && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <p className="text-muted-foreground text-sm">
                                        <strong>Step 1:</strong> Add the following TXT record to your DNS settings:
                                    </p>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Host / Name</Label>
                                            <CopyableText
                                                text={domainInfo.verificationRecord.host}
                                                successMessage="Host copied!"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Value / Content</Label>
                                            <CopyableText
                                                text={domainInfo.verificationRecord.value}
                                                successMessage="Value copied!"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-muted-foreground text-sm">
                                        <strong>Step 2:</strong> After adding the DNS record, click &quot;Verify&quot;
                                        below.
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        DNS changes may take up to 48 hours to propagate, but usually happen within a
                                        few minutes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === "complete" && (
                        <div className="space-y-4 text-center">
                            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                                <CheckCircleIcon className="size-8 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="font-medium">{domainInfo?.domain || domain}</p>
                                <p className="text-muted-foreground text-sm">
                                    Your custom domain has been added successfully.
                                </p>
                            </div>
                            {isSubpathDomain ? (
                                <div className="space-y-3 rounded-md bg-yellow-50 p-3 text-left text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                                    <p>
                                        <strong>Next step:</strong> Configure a reverse proxy on your server to forward
                                        requests to Fern.
                                    </p>
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium uppercase text-yellow-700 dark:text-yellow-300">
                                            Proxy Configuration:
                                        </p>
                                        <ul className="list-inside list-disc space-y-1 text-xs">
                                            <li>
                                                Forward requests from{" "}
                                                <code className="rounded bg-yellow-100 px-1 dark:bg-yellow-900/40">
                                                    {domainInfo?.domain || domain}
                                                </code>{" "}
                                                to{" "}
                                                <code className="rounded bg-yellow-100 px-1 dark:bg-yellow-900/40">
                                                    https://app.buildwithfern.com
                                                </code>
                                            </li>
                                            <li>
                                                Add header:{" "}
                                                <code className="rounded bg-yellow-100 px-1 dark:bg-yellow-900/40">
                                                    X-Fern-Host: {domainHostOnly}
                                                </code>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-md bg-yellow-50 p-3 text-left text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                                    <p>
                                        <strong>Next step:</strong> Add a CNAME record pointing{" "}
                                        <code className="rounded bg-yellow-100 px-1 dark:bg-yellow-900/40">
                                            {domainInfo?.domain || domain}
                                        </code>{" "}
                                        to{" "}
                                        <code className="rounded bg-yellow-100 px-1 dark:bg-yellow-900/40">
                                            cname.vercel-dns.com
                                        </code>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="bg-destructive/10 text-destructive mt-4 rounded-md p-3 text-sm">{error}</div>
                    )}
                </DialogBody>

                <DialogFooter>
                    {step === "enter-domain" && (
                        <>
                            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button onClick={handleInitiate} disabled={!domain.trim() || isLoading} loading={isLoading}>
                                Continue
                            </Button>
                        </>
                    )}

                    {step === "update-config" && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setStep("enter-domain");
                                    setError(null);
                                    setPrUrl(null);
                                }}
                                disabled={isCreatingPr}
                            >
                                Back
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setStep("verify-dns")}
                                disabled={isCreatingPr || !gitStatus.checked}
                            >
                                Continue
                            </Button>
                        </>
                    )}

                    {step === "verify-dns" && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setStep("update-config");
                                    setError(null);
                                }}
                                disabled={isLoading}
                            >
                                Back
                            </Button>
                            <Button onClick={handleVerify} loading={isLoading}>
                                Verify Domain
                            </Button>
                        </>
                    )}

                    {step === "complete" && <Button onClick={handleClose}>Done</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
