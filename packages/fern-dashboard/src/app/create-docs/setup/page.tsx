"use client";

import { ArrowLeft, Building2, Check, Globe, Loader2, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { checkDocsUrlAvailability } from "@/app/actions/docsWizard";
import type { Auth0Organization } from "@/app/services/auth0/types";
import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInvalidateOrganizations, useOrganizations } from "@/state/useOrganizations";
import { CreateOrganizationModalInline } from "./CreateOrganizationModalInline";

interface DocsCustomization {
    templateId: "classic" | "minimal" | "products" | "no-top-bar";
    companyName?: string | null;
    primaryColor?: string | null;
    headingsFont?: string;
    bodyFont?: string;
    codeFont?: string;
    logoBase64?: string | null;
    faviconBase64?: string | null;
}

interface SiteToDocsOutput {
    files: Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>;
    sourceUrl: string;
    pagesConverted: number;
    totalFiles: number;
    warnings: string[];
}

export default function SetupPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const organizations = useOrganizations();
    const invalidateOrganizations = useInvalidateOrganizations();

    const [selectedOrgName, setSelectedOrgName] = useState<string>("");
    const [customization, setCustomization] = useState<DocsCustomization | null>(null);
    const [siteToDocsOutput, setSiteToDocsOutput] = useState<SiteToDocsOutput | null>(null);
    const [flowType, setFlowType] = useState<"template" | "site-to-docs">("template");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

    // Progress state
    const [progress, setProgress] = useState<{ step: number; totalSteps: number; message: string } | null>(null);

    // URL input state
    const [urlPrefix, setUrlPrefix] = useState<string>("");
    const [isCheckingUrl, setIsCheckingUrl] = useState(false);
    const [isUrlAvailable, setIsUrlAvailable] = useState<boolean | null>(null);
    const [urlError, setUrlError] = useState<string | null>(null);

    // Validate subdomain format
    const validateSubdomain = useCallback((val: string): string | null => {
        if (!val) {
            return null; // Empty is handled separately
        }
        if (val.length > 63) {
            return "Subdomain must be 63 characters or fewer.";
        }
        if (!/^[a-z0-9-_]+$/.test(val)) {
            return "Use lowercase letters, numbers, underscores, and hyphens only.";
        }
        if (/--/.test(val)) {
            return "Consecutive hyphens are not allowed.";
        }
        if (/^[-_]|[-_]$/.test(val)) {
            return "Cannot start or end with a hyphen or underscore.";
        }
        return null;
    }, []);

    // Check URL availability with debounce
    useEffect(() => {
        setIsUrlAvailable(null);
        setUrlError(null);

        if (!urlPrefix) {
            return;
        }

        const validationError = validateSubdomain(urlPrefix);
        if (validationError) {
            setUrlError(validationError);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsCheckingUrl(true);
            try {
                const result = await checkDocsUrlAvailability(urlPrefix);
                if (result.error) {
                    setUrlError(result.error);
                    setIsUrlAvailable(false);
                } else {
                    setIsUrlAvailable(result.available);
                    if (!result.available) {
                        setUrlError("This URL has already been claimed; try again.");
                    }
                }
            } catch (err) {
                console.error("Error checking URL availability:", err);
                setUrlError("Failed to check URL availability");
                setIsUrlAvailable(false);
            } finally {
                setIsCheckingUrl(false);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [urlPrefix, validateSubdomain]);

    // Read customization or site-to-docs output from sessionStorage on mount
    useEffect(() => {
        const source = searchParams.get("source");

        // Check for site-to-docs flow first
        if (source === "site-to-docs") {
            try {
                const stored = sessionStorage.getItem("siteToDocsOutput");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setSiteToDocsOutput(parsed);
                    setFlowType("site-to-docs");
                    return;
                }
            } catch (e) {
                console.error("Failed to read site-to-docs output from sessionStorage:", e);
            }
            // If no site-to-docs output found, redirect back
            router.push("/create-docs/import");
            return;
        }

        // Template flow
        try {
            const stored = sessionStorage.getItem("docsCustomization");
            if (stored) {
                const parsed = JSON.parse(stored);
                setCustomization(parsed);
                setFlowType("template");
            } else {
                // No customization found, redirect back to templates
                router.push("/create-docs/templates");
            }
        } catch (e) {
            console.error("Failed to read customization from sessionStorage:", e);
            router.push("/create-docs/templates");
        }
    }, [router, searchParams]);

    // Auto-select first org when loaded
    useEffect(() => {
        if (organizations.type === "loaded" && organizations.value.length > 0 && !selectedOrgName) {
            setSelectedOrgName(organizations.value[0]!.name);
        }
    }, [organizations, selectedOrgName]);

    const handleCreateRepo = async () => {
        // Validate based on flow type
        if (!selectedOrgName || !urlPrefix || !isUrlAvailable) {
            return;
        }
        if (flowType === "template" && !customization) {
            return;
        }
        if (flowType === "site-to-docs" && !siteToDocsOutput) {
            return;
        }

        setIsCreating(true);
        setError(null);
        setProgress(null);

        try {
            // Build request body based on flow type
            const body =
                flowType === "site-to-docs"
                    ? {
                          orgName: selectedOrgName,
                          urlPrefix,
                          sourceType: "site-to-docs",
                          siteToDocsFiles: siteToDocsOutput!.files,
                          sourceUrl: siteToDocsOutput!.sourceUrl
                      }
                    : {
                          orgName: selectedOrgName,
                          urlPrefix,
                          sourceType: "template",
                          templateId: customization!.templateId,
                          companyName: customization!.companyName,
                          primaryColorHex: customization!.primaryColor,
                          fonts: {
                              headings: customization!.headingsFont,
                              body: customization!.bodyFont,
                              code: customization!.codeFont
                          },
                          logoBase64: customization!.logoBase64,
                          faviconBase64: customization!.faviconBase64
                      };

            // Use SSE endpoint for progress updates
            const response = await fetch("/api/create-docs-repo/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error("Failed to start repository creation");
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const event = JSON.parse(line.slice(6));

                            if (event.type === "progress") {
                                setProgress({
                                    step: event.step,
                                    totalSteps: event.totalSteps,
                                    message: event.message
                                });
                            } else if (event.type === "complete") {
                                const result = event.data;

                                // Clear data from sessionStorage
                                if (flowType === "site-to-docs") {
                                    sessionStorage.removeItem("siteToDocsOutput");
                                    sessionStorage.removeItem("siteToDocsInput");
                                } else {
                                    sessionStorage.removeItem("docsCustomization");
                                }

                                // Navigate to success page
                                const params = new URLSearchParams({
                                    repo: result.githubRepoUrl,
                                    repoName: result.repoName,
                                    collaboratorAdded: String(result.collaboratorAdded),
                                    siteUrl: `${urlPrefix}.docs.buildwithfern.com`,
                                    fernTokenSet: String(result.fernTokenSet ?? false),
                                    orgName: selectedOrgName
                                });
                                router.push(`/create-docs/success?${params.toString()}`);
                                return;
                            } else if (event.type === "error") {
                                throw new Error(event.message);
                            }
                        } catch (_parseError) {
                            // Ignore parse errors for partial data
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Error creating repo:", err);
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
            setIsCreating(false);
            setProgress(null);
        }
    };

    const handleOrgCreated = (newOrgName: string) => {
        // Refresh the organizations list and select the new org
        invalidateOrganizations();
        setSelectedOrgName(newOrgName);
        setShowCreateOrgModal(false);
    };

    const isLoading = organizations.type === "loading";
    const orgs = organizations.type === "loaded" ? organizations.value : [];

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden">
            {/* Radial gradient background */}
            <div className="bg-gradient-radial pointer-events-none absolute inset-0 from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black" />

            {/* Blurred green blob */}
            <svg
                className="pointer-events-none absolute"
                style={{
                    width: "1351px",
                    height: "525px",
                    left: "-90px",
                    bottom: "197px"
                }}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1001 656"
                fill="none"
            >
                <g opacity="0.1" filter="url(#filter0_f_setup)">
                    <path
                        d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                        fill="#51C233"
                    />
                </g>
                <defs>
                    <filter
                        id="filter0_f_setup"
                        x="0"
                        y="0"
                        width="1000.09"
                        height="655.083"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                        <feGaussianBlur stdDeviation="66" result="effect1_foregroundBlur" />
                    </filter>
                </defs>
            </svg>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 w-full p-4"
            >
                <div className="flex items-center justify-between">
                    <Link href="/">
                        <ThemedFernLogo className="w-16" />
                    </Link>
                    <Link
                        href={flowType === "site-to-docs" ? "/create-docs/import" : "/create-docs/customize"}
                        className="flex items-center gap-2 text-sm text-text-description transition-colors hover:text-gray-1200"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </div>
            </motion.div>

            {/* Main content */}
            <div className="relative z-10 flex flex-1 items-center justify-center px-8 pb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="w-full max-w-md"
                >
                    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
                            Set up your docs site
                        </h1>
                        <p className="mb-6 text-sm text-text-description">
                            Choose a URL and organization for your documentation.
                        </p>

                        <div className="flex flex-col gap-6">
                            {/* URL input */}
                            <div className="flex flex-col gap-2">
                                <Label className="text-sm font-medium text-gray-900 dark:text-white">URL</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="text"
                                        placeholder="my-company"
                                        value={urlPrefix}
                                        onChange={(e) => setUrlPrefix(e.target.value.toLowerCase())}
                                        className="flex-1"
                                    />
                                    <span className="flex items-center gap-2 whitespace-nowrap text-sm text-text-description">
                                        .docs.buildwithfern.com
                                        {isCheckingUrl && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
                                        {!isCheckingUrl && isUrlAvailable === false && (
                                            <X className="h-4 w-4 text-red-500" />
                                        )}
                                        {!isCheckingUrl && isUrlAvailable === true && (
                                            <Check className="h-4 w-4 text-green-500" />
                                        )}
                                    </span>
                                </div>
                                {urlError && <p className="text-xs text-red-600">{urlError}</p>}
                            </div>

                            {/* Organization selector */}
                            <div className="flex flex-col gap-2">
                                <Label className="text-sm font-medium text-gray-900 dark:text-white">
                                    Organization
                                </Label>
                                {isLoading ? (
                                    <div className="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800">
                                        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                                        <span className="text-sm text-text-muted">Loading organizations...</span>
                                    </div>
                                ) : orgs.length === 0 ? (
                                    <div className="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800">
                                        <Building2 className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm text-text-muted">No organizations found</span>
                                    </div>
                                ) : (
                                    <Select value={selectedOrgName} onValueChange={setSelectedOrgName}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select an organization" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {orgs.map((org: Auth0Organization) => (
                                                <SelectItem key={org.id} value={org.name}>
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4" />
                                                        {org.display_name || org.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {/* Create new org button */}
                                <button
                                    onClick={() => setShowCreateOrgModal(true)}
                                    className="flex items-center gap-2 text-sm text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create new organization
                                </button>
                            </div>

                            {/* Source info */}
                            {flowType === "site-to-docs" && siteToDocsOutput && (
                                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                                    <div className="flex items-center gap-2 text-xs text-text-muted">
                                        <Globe className="h-3.5 w-3.5" />
                                        <span>Imported from:</span>
                                        <span className="truncate font-medium text-text-description">
                                            {siteToDocsOutput.sourceUrl}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-text-muted">
                                        {siteToDocsOutput.pagesConverted} pages converted
                                    </p>
                                </div>
                            )}
                            {flowType === "template" && customization && (
                                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                                    <p className="text-xs text-text-muted">
                                        Template:{" "}
                                        <span className="font-medium text-text-description capitalize">
                                            {customization.templateId.replace(/-/g, " ")}
                                        </span>
                                    </p>
                                </div>
                            )}

                            {/* Error display */}
                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            {/* Create Repository button */}
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={handleCreateRepo}
                                    disabled={
                                        !selectedOrgName ||
                                        isCreating ||
                                        !urlPrefix ||
                                        !isUrlAvailable ||
                                        (flowType === "template" && !customization) ||
                                        (flowType === "site-to-docs" && !siteToDocsOutput)
                                    }
                                    className="w-full bg-green-500 hover:bg-green-600"
                                >
                                    {isCreating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating repository...
                                        </>
                                    ) : (
                                        "Create Repository"
                                    )}
                                </Button>

                                {/* Progress bar */}
                                {isCreating && progress && (
                                    <div className="flex flex-col gap-2">
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                            <div
                                                className="h-full rounded-full bg-green-500 transition-all duration-300 ease-out"
                                                style={{
                                                    width: `${(progress.step / progress.totalSteps) * 100}%`
                                                }}
                                            />
                                        </div>
                                        <p className="text-center text-xs text-text-muted">{progress.message}</p>
                                    </div>
                                )}
                            </div>

                            {!isCreating && (
                                <p className="text-center text-xs text-text-muted">
                                    A private GitHub repository will be created with your documentation.
                                </p>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Create Organization Modal */}
            <CreateOrganizationModalInline
                open={showCreateOrgModal}
                onOpenChange={setShowCreateOrgModal}
                onOrgCreated={handleOrgCreated}
            />
        </div>
    );
}
