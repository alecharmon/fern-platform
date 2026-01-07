"use client";

import {
    CheckCircleIcon,
    CopyIcon,
    ExternalLinkIcon,
    GitMergeIcon,
    GitPullRequestIcon,
    Loader2Icon,
    RefreshCwIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
    createCustomDomainPr,
    getDnsRecords,
    initiateCustomDomain,
    updateDomainSetupStep,
    verifyCustomDomain
} from "@/app/actions/customDomain";
import { type GitProvider, getGitConnectionStatus } from "@/app/actions/customDomain/getGitConnectionStatus";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { CustomDomainInfo, VercelDnsRecord } from "@/app/services/domain";
import { getDomainWithoutSubpath, getSubpath, hasSubpath } from "@/app/services/domain/validation";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { CopyableText } from "../ui/CopyableText";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type ModalStep = "enter-domain" | "update-config" | "verify-ownership" | "verify-dns" | "configure-proxy" | "complete";

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
    const [step, setStep] = useState<ModalStep>(existingDomainInfo ? "verify-ownership" : "enter-domain");
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

    // DNS records state (fetched from Vercel after verification)
    const [dnsRecords, setDnsRecords] = useState<VercelDnsRecord[]>([]);
    const [loadingDnsRecords, setLoadingDnsRecords] = useState(false);

    // DNS configuration verification state
    const [isVerifyingDns, setIsVerifyingDns] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Proxy confirmation state
    const [isConfirmingProxy, setIsConfirmingProxy] = useState(false);

    // Track whether we've initialized the modal for this open session
    const hasInitializedRef = useRef(false);
    const prevOpenRef = useRef(open);

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Helper to get terminology based on provider
    const prTerminology = gitStatus.provider === "gitlab" ? "Merge Request" : "Pull Request";
    const prShortTerminology = gitStatus.provider === "gitlab" ? "MR" : "PR";
    const PrIcon = gitStatus.provider === "gitlab" ? GitMergeIcon : GitPullRequestIcon;

    // Reset state when modal opens (only on open transition, not on existingDomainInfo changes)
    useEffect(() => {
        prevOpenRef.current = open;

        // Only initialize when modal is opening (transitioning from closed to open)
        if (!open) {
            hasInitializedRef.current = false;
            return;
        }

        if (hasInitializedRef.current) {
            return;
        }

        hasInitializedRef.current = true;

        // Reset common state
        setError(null);
        setGitStatus({ checked: false, connected: false });
        setPrUrl(null);
        setDnsRecords([]);
        setLoadingDnsRecords(false);
        setIsVerifyingDns(false);

        // Reset to appropriate initial state when modal opens
        if (existingDomainInfo) {
            setDomain(existingDomainInfo.domain || "");
            setDomainInfo(existingDomainInfo);

            // Use persisted setupStep if available
            if (existingDomainInfo.setupStep) {
                setStep(existingDomainInfo.setupStep);

                // If on verify-dns step, fetch DNS records
                if (existingDomainInfo.setupStep === "verify-dns" && existingDomainInfo.domain) {
                    setLoadingDnsRecords(true);
                    getDnsRecords({ domain: existingDomainInfo.domain, orgName })
                        .then((result) => {
                            if (result.success && result.dnsRecords.length > 0) {
                                setDnsRecords(result.dnsRecords);
                            }
                        })
                        .catch((err) => console.error("Failed to fetch DNS records:", err))
                        .finally(() => setLoadingDnsRecords(false));
                }
            } else {
                // Fallback for domains without setupStep (legacy)
                const isVerified = existingDomainInfo.status === "VERIFIED";
                if (isVerified) {
                    const domainToCheck = existingDomainInfo.domain;
                    const isSubpath = domainToCheck ? hasSubpath(domainToCheck) : false;

                    if (isSubpath) {
                        setStep("configure-proxy");
                    } else if (domainToCheck) {
                        setStep("verify-dns");
                        setLoadingDnsRecords(true);
                        getDnsRecords({ domain: domainToCheck, orgName })
                            .then((result) => {
                                if (result.success && result.dnsRecords.length > 0) {
                                    setDnsRecords(result.dnsRecords);
                                }
                            })
                            .catch((err) => console.error("Failed to fetch DNS records:", err))
                            .finally(() => setLoadingDnsRecords(false));
                    }
                } else {
                    setStep("verify-ownership");
                }
            }
        } else {
            setStep("enter-domain");
            setDomain("");
            setDomainInfo(undefined);
        }
    }, [open, existingDomainInfo, orgName]);

    // Check if the domain has a subpath (e.g., example.com/docs)
    // Check both domainInfo and the original domain input in case one doesn't include the subpath
    const isSubpathDomain = useMemo(() => {
        return hasSubpath(domainInfo?.domain || "") || hasSubpath(domain);
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
                orgName,
                domain: domainInfo?.domain || domain
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

            toast.success(`Domain ownership verified for ${domain}!`);

            // Check for subpath using the original domain input (more reliable than result)
            const isSubpath = hasSubpath(domain);
            const nextStep = isSubpath ? "configure-proxy" : "verify-dns";

            // Persist the step
            const stepResult = await updateDomainSetupStep({ docsUrl, orgName, step: nextStep });
            if (stepResult.success) {
                setDomainInfo(stepResult.domainInfo);
            } else {
                setDomainInfo(result.domainInfo);
            }

            setStep(nextStep);

            if (!isSubpath) {
                // For regular domains, fetch DNS records
                const domainToFetch = result.domainInfo?.domain || domain;
                if (domainToFetch) {
                    setLoadingDnsRecords(true);
                    try {
                        const dnsResult = await getDnsRecords({ domain: domainToFetch, orgName });
                        if (dnsResult.success && dnsResult.dnsRecords.length > 0) {
                            setDnsRecords(dnsResult.dnsRecords);
                        }
                    } catch (dnsError) {
                        console.error("Failed to fetch DNS records:", dnsError);
                    } finally {
                        setLoadingDnsRecords(false);
                    }
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyDnsConfig = async () => {
        const domainToCheck = domainInfo?.domain || domain;
        if (!domainToCheck || isSubpathDomain) {
            return;
        }

        setIsVerifyingDns(true);

        // Poll up to 5 times with 2 second intervals
        const maxAttempts = 5;
        const pollInterval = 2000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const result = await getDnsRecords({ domain: domainToCheck, orgName });

                if (result.success && !result.misconfigured) {
                    // Persist the complete step
                    const stepResult = await updateDomainSetupStep({ docsUrl, orgName, step: "complete" });
                    if (stepResult.success) {
                        setDomainInfo(stepResult.domainInfo);
                    }

                    setDnsRecords([]); // Clear records since they're now configured
                    toast.success("DNS records verified! Your custom domain is fully configured.");
                    setIsVerifyingDns(false);
                    setStep("complete");
                    return;
                }

                // Update records if we got new ones
                if (result.success && result.dnsRecords.length > 0) {
                    setDnsRecords(result.dnsRecords);
                }

                // If not the last attempt, wait before trying again
                if (attempt < maxAttempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, pollInterval));
                }
            } catch (error) {
                console.error("Error checking DNS configuration:", error);
            }
        }

        // If we get here, DNS is not yet configured
        setIsVerifyingDns(false);
        toast.info("DNS records not yet detected. Please allow time for DNS propagation and try again.");
    };

    const handleConfirmProxy = async () => {
        setIsConfirmingProxy(true);
        setError(null);

        try {
            const result = await updateDomainSetupStep({ docsUrl, orgName, step: "complete" });

            if (!result.success) {
                setError(result.error || "Failed to confirm proxy setup.");
                return;
            }

            setDomainInfo(result.domainInfo);
            setStep("complete");
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
        } finally {
            setIsConfirmingProxy(false);
        }
    };

    const handleClose = () => {
        // Refresh if domain was initiated, status changed, or setup step changed
        const domainWasInitiated = domainInfo && !existingDomainInfo;
        const statusChanged = domainInfo?.status !== existingDomainInfo?.status;
        const stepChanged = domainInfo?.setupStep !== existingDomainInfo?.setupStep;
        const shouldRefresh = domainWasInitiated || statusChanged || stepChanged;

        onOpenChange(false);
        // State reset is handled by the useEffect when modal reopens

        if (shouldRefresh) {
            router.refresh();
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!isLoading && !isCreatingPr && !isConfirmingProxy) {
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
                        {step === "verify-ownership" && "Verify Domain Ownership"}
                        {step === "verify-dns" && `Configure DNS for ${domainInfo?.domain || domain}`}
                        {step === "configure-proxy" && "Reverse Proxy Configuration"}
                        {step === "complete" && "Setup Complete"}
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

                    {step === "verify-ownership" && domainInfo && (
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
                                            <th className="px-4 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-border/50 last:border-0">
                                            <td className="px-4 py-3 font-mono text-xs">TXT</td>
                                            <td className="px-4 py-3 font-mono text-xs">
                                                {domainInfo.verificationRecord.host}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs break-all max-w-[300px]">
                                                {domainInfo.verificationRecord.value}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        copyToClipboard(
                                                            domainInfo.verificationRecord.value,
                                                            "txt-record"
                                                        )
                                                    }
                                                    className="text-muted-foreground h-7 w-7 p-0"
                                                >
                                                    {copiedField === "txt-record" ? (
                                                        <CheckCircleIcon className="size-3.5 text-green-500" />
                                                    ) : (
                                                        <CopyIcon className="size-3.5" />
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                DNS changes may take up to 48 hours to propagate, but usually happen within a few
                                minutes.
                            </p>
                        </div>
                    )}

                    {step === "verify-dns" &&
                        (() => {
                            // Use fetched records, or fall back to default CNAME
                            const recordsToShow: VercelDnsRecord[] =
                                dnsRecords.length > 0
                                    ? dnsRecords
                                    : [
                                          {
                                              type: "CNAME",
                                              name: domainInfo?.domain || domain,
                                              value: "cname.vercel-dns.com"
                                          }
                                      ];

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
                                                        <th className="px-4 py-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recordsToShow.map((record, index) => (
                                                        <tr
                                                            key={`${record.type}-${record.name}-${index}`}
                                                            className="border-b border-border/50 last:border-0"
                                                        >
                                                            <td className="px-4 py-3 font-mono text-xs">
                                                                {record.type}
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-xs">
                                                                {record.name}
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-xs break-all max-w-[300px]">
                                                                {record.value}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        copyToClipboard(record.value, `record-${index}`)
                                                                    }
                                                                    className="text-muted-foreground h-7 w-7 p-0"
                                                                >
                                                                    {copiedField === `record-${index}` ? (
                                                                        <CheckCircleIcon className="size-3.5 text-green-500" />
                                                                    ) : (
                                                                        <CopyIcon className="size-3.5" />
                                                                    )}
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <p className="text-xs text-muted-foreground">
                                        DNS changes may take up to 48 hours to propagate, but usually happen within a
                                        few minutes.
                                    </p>
                                </div>
                            );
                        })()}

                    {step === "configure-proxy" && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Configure a reverse proxy on your server to forward requests from{" "}
                                <code className="rounded bg-muted px-1">{domainInfo?.domain || domain}</code> to Fern.
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
                                Forward all requests from{" "}
                                <code className="rounded bg-muted px-1">{domainInfo?.domain || domain}</code> to the
                                proxy target with the header above.
                            </p>
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
                                    Your custom domain has been configured successfully.
                                </p>
                            </div>
                            {isSubpathDomain ? (
                                <div className="w-full rounded-md border border-green-200 bg-green-50 p-4 text-left dark:border-green-800 dark:bg-green-900/20">
                                    <div className="flex items-start gap-3">
                                        <CheckCircleIcon className="mt-0.5 size-5 text-green-600 dark:text-green-400" />
                                        <div>
                                            <p className="font-medium text-green-800 dark:text-green-200">
                                                Reverse Proxy Configured
                                            </p>
                                            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                                                Your custom domain is fully set up and ready to use.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full rounded-md border border-green-200 bg-green-50 p-4 text-left dark:border-green-800 dark:bg-green-900/20">
                                    <div className="flex items-start gap-3">
                                        <CheckCircleIcon className="mt-0.5 size-5 text-green-600 dark:text-green-400" />
                                        <div>
                                            <p className="font-medium text-green-800 dark:text-green-200">
                                                DNS Configured Successfully
                                            </p>
                                            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                                                Your custom domain is fully set up and ready to use.
                                            </p>
                                        </div>
                                    </div>
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
                                onClick={() => setStep("verify-ownership")}
                                disabled={isCreatingPr || !gitStatus.checked}
                            >
                                Continue
                            </Button>
                        </>
                    )}

                    {step === "verify-ownership" && (
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
                                Verify Ownership
                            </Button>
                        </>
                    )}

                    {step === "verify-dns" && (
                        <>
                            <Button variant="outline" onClick={handleVerifyDnsConfig} disabled={isVerifyingDns}>
                                <RefreshCwIcon className={`mr-2 size-4 ${isVerifyingDns ? "animate-spin" : ""}`} />
                                Check DNS Status
                            </Button>
                            <Button onClick={handleClose}>Done</Button>
                        </>
                    )}

                    {step === "configure-proxy" && (
                        <>
                            <Button variant="outline" onClick={handleClose} disabled={isConfirmingProxy}>
                                Close
                            </Button>
                            <Button onClick={handleConfirmProxy} loading={isConfirmingProxy}>
                                Confirm Setup Complete
                            </Button>
                        </>
                    )}

                    {step === "complete" && <Button onClick={handleClose}>Done</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
