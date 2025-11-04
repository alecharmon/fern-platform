"use client";

import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { ThemedFernLogo } from "@/components/theme/ThemedFernLogo";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import ConfirmScreen from "./ConfirmScreen";
import UploadForm from "./UploadForm";

export interface WizardFormData {
    docsSiteName: string;
    docsSiteUrl: string;
    docsSiteUrlAvailable: boolean | null;
    faviconUrl: string | null;
    logoUrl: string | null;
    primaryColorHex: string | null;
    existingDocsSite: string;
    openApiSpecUrls: { fileName: string; assetUrl: string }[];
}

export default function NewDocsWizardPage() {
    const orgName = useOrgNameFromPathname();
    const [currentStep, setCurrentStep] = useState<"docsSiteInfo" | "confirmation">("docsSiteInfo");
    const [showExitDialog, setShowExitDialog] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fernDocsDownloadUrl, setFernDocsDownloadUrl] = useState<string | undefined>(undefined);
    const [githubRepoUrl, setGithubRepoUrl] = useState<string | undefined>(undefined);
    const [formData, setFormData] = useState<WizardFormData>({
        docsSiteName: "",
        docsSiteUrl: "",
        docsSiteUrlAvailable: null,
        faviconUrl: null,
        logoUrl: null,
        primaryColorHex: null,
        existingDocsSite: "",
        openApiSpecUrls: []
    });

    const handleExitClick = () => {
        setShowExitDialog(true);
    };

    async function onSubmitForm() {
        if (currentStep === "docsSiteInfo") {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/onboarding-docs", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ ...formData, orgName })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || "Failed to create documentation");
                }

                const result = await response.json();

                // Store the download URL if available
                if (result.fernDocsDownloadUrl) {
                    setFernDocsDownloadUrl(result.fernDocsDownloadUrl);
                }

                // Store the GitHub repo URL if available
                if (result.githubRepoUrl) {
                    setGithubRepoUrl(result.githubRepoUrl);
                }

                setCurrentStep("confirmation");
            } catch (err) {
                console.error("Error creating docs:", err);
                setError(err instanceof Error ? err.message : "An unexpected error occurred");
            } finally {
                setIsLoading(false);
            }
        }
    }

    async function handlePublishToGithub() {
        if (!fernDocsDownloadUrl) {
            console.error("No download URL available");
            return;
        }

        try {
            const response = await fetch("/api/publish-to-github", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    orgName,
                    docsSiteUrl: formData.docsSiteUrl,
                    docsSiteName: formData.docsSiteName,
                    fernDocsDownloadUrl
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to publish to GitHub");
            }

            const result = await response.json();

            // Update the GitHub repo URL
            if (result.githubRepoUrl) {
                setGithubRepoUrl(result.githubRepoUrl);
            }
        } catch (err) {
            console.error("Error publishing to GitHub:", err);
            throw err; // Re-throw so the ConfirmScreen can handle it
        }
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden">
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
                <g opacity="0.1" filter="url(#filter0_f_wizard)">
                    <path
                        d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                        fill="#51C233"
                    />
                </g>
                <defs>
                    <filter
                        id="filter0_f_wizard"
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

            {/* Header with Fern logo, step indicator, and close button */}
            <div className="relative z-10 w-full p-4">
                <div className="flex items-center justify-between">
                    <button onClick={handleExitClick} className="cursor-pointer">
                        <ThemedFernLogo className="w-16" />
                    </button>
                    <button
                        onClick={handleExitClick}
                        className="rounded-xs cursor-pointer p-2 opacity-70 transition-opacity hover:opacity-100"
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <AnimatePresence mode="wait">
                {currentStep === "docsSiteInfo" && (
                    <motion.div
                        key="uploadForm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="relative z-10 flex w-full flex-1 flex-col items-center"
                    >
                        <UploadForm
                            wizardFormData={formData}
                            setWizardFormData={setFormData}
                            onSubmitForm={onSubmitForm}
                            isLoading={isLoading}
                            error={error}
                        />
                    </motion.div>
                )}
                {currentStep === "confirmation" && (
                    <motion.div
                        key="confirmScreen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="relative z-10 flex w-full flex-1"
                    >
                        <ConfirmScreen
                            docsUrl={formData.docsSiteUrl}
                            wizardFormData={formData}
                            fernDocsDownloadUrl={fernDocsDownloadUrl}
                            githubRepoUrl={githubRepoUrl}
                            onPublishToGithub={handlePublishToGithub}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Exit confirmation dialog */}
            <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Exit wizard?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to exit? Your progress will not be saved.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowExitDialog(false)}>
                            Cancel
                        </Button>
                        <Button variant="default" asChild>
                            <Link href={`/${orgName}`}>Exit</Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
