"use client";

import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import ExclamationCircleIcon from "@heroicons/react/24/outline/ExclamationCircleIcon";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { normalizeGithubUrl } from "@/app/services/github/github";
import { useValidateGithubRepo } from "@/hooks/useValidateGithubRepo";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { VisualEditorValidationErrorHandler } from "./visual-editor-section/VisualEditorValidationErrorHandler";

type ValidationMode = "full" | "simple";

interface GithubRepoInputProps {
    docsUrl: DocsUrl;
    initialUrl?: string;
    onSave: (canonicalUrl: string, accessCheckResult?: { ok: boolean; appInstalled?: boolean }) => void | Promise<void>;
    disabled?: boolean;
    saveButtonText?: string;
    className?: string;
    autoFocus?: boolean;
    /**
     * Validation mode:
     * - "full": Requires GitHub app installed, shows detailed error messages and install links
     * - "simple": Only validates URL format, allows saving without app installed
     */
    validationType?: ValidationMode;
}

export function GithubRepoInput({
    docsUrl,
    initialUrl = "",
    onSave,
    disabled = false,
    saveButtonText = "Connect",
    className,
    autoFocus = false,
    validationType = "full"
}: GithubRepoInputProps) {
    const [inputUrl, setInputUrl] = useState(initialUrl);
    const [debouncedUrl, setDebouncedUrl] = useState(initialUrl);

    const isSimpleMode = validationType === "simple";

    // Update input when initialUrl changes
    useEffect(() => {
        setInputUrl(initialUrl);
        setDebouncedUrl(initialUrl);
    }, [initialUrl]);

    // Debounce the URL input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedUrl(inputUrl);
        }, 500);
        return () => clearTimeout(timer);
    }, [inputUrl]);

    const normalized = normalizeGithubUrl(debouncedUrl);
    const shouldCheckAccess = normalized.isValidShape && normalized.owner && normalized.repo;

    const { result: accessCheckResult, loading: isCheckingAccess } = useValidateGithubRepo({
        enabled: !!shouldCheckAccess,
        docsUrl,
        owner: normalized.owner ?? undefined,
        repo: normalized.repo ?? undefined
    });

    const currentNormalized = normalizeGithubUrl(inputUrl);
    const urlIsValid = currentNormalized.isValidShape;
    const showValidation = inputUrl.trim() !== "";

    const hasAccessGranted = accessCheckResult?.ok === true;
    const hasAccessDenied = accessCheckResult?.ok === false;
    const appNotInstalled = hasAccessDenied && !accessCheckResult?.appInstalled;

    // Determine if we're ready to save based on validation mode
    const readyToSave = isSimpleMode
        ? // Simple mode: just need valid URL and debounce to complete
          urlIsValid &&
          normalized.owner === currentNormalized.owner &&
          normalized.repo === currentNormalized.repo &&
          !isCheckingAccess &&
          !disabled
        : // Full mode: need valid URL and app installed
          urlIsValid &&
          hasAccessGranted &&
          normalized.owner === currentNormalized.owner &&
          normalized.repo === currentNormalized.repo &&
          !isCheckingAccess &&
          !disabled;

    const handleSave = async () => {
        if (!readyToSave || !currentNormalized.canonicalUrl) {
            return;
        }
        await onSave(currentNormalized.canonicalUrl, accessCheckResult ?? undefined);
    };

    // Determine border color based on validation mode
    const getBorderColor = () => {
        if (!showValidation) {
            return "";
        }
        if (isSimpleMode) {
            // Simple mode: just green for valid, red for invalid
            return urlIsValid ? "border-green-600 dark:border-green-600" : "border-red-500 dark:border-red-600";
        }
        // Full validation mode: show access check status
        if (urlIsValid && hasAccessGranted) {
            return "border-green-600 dark:border-green-600";
        }
        if (urlIsValid && hasAccessDenied) {
            return "border-red-500 dark:border-red-600";
        }
        if (urlIsValid) {
            return "border-green-600 dark:border-green-600";
        }
        return "border-red-500 dark:border-red-600";
    };

    // Determine which icon to show in the input
    const getValidationIcon = () => {
        if (!showValidation) {
            return null;
        }
        if (isCheckingAccess) {
            return <Loader2 className="mr-1.5 size-4 animate-spin text-gray-500" />;
        }
        if (!urlIsValid) {
            return <ExclamationCircleIcon className="mr-1.5 size-4 text-red-500 dark:text-red-600" />;
        }
        // Valid URL
        if (isSimpleMode || hasAccessGranted) {
            return <CheckCircleIcon className="mr-1.5 size-4 text-green-600 dark:text-green-600" />;
        }
        if (hasAccessDenied) {
            return <ExclamationCircleIcon className="mr-1.5 size-4 text-red-500 dark:text-red-600" />;
        }
        return null;
    };

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div
                className={`border-border flex flex-1 items-center rounded-md border pr-0.5 transition-colors ${getBorderColor()}`}
            >
                <Input
                    placeholder="https://github.com/example/repo"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && readyToSave) {
                            void handleSave();
                        }
                    }}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
                />
                {getValidationIcon()}
            </div>

            {/* Validation messages */}
            {showValidation && (
                <>
                    {/* Invalid URL message */}
                    {!urlIsValid && (
                        <div className="text-xs text-red-500 dark:text-red-600">
                            Please enter a valid GitHub repository URL
                        </div>
                    )}

                    {/* Access denied message */}
                    {!isSimpleMode && urlIsValid && hasAccessDenied && accessCheckResult?.error && (
                        <div className="text-xs text-red-500 dark:text-red-600">
                            <VisualEditorValidationErrorHandler error={accessCheckResult.error} />
                        </div>
                    )}

                    {/* App not installed message */}
                    {!isSimpleMode && urlIsValid && appNotInstalled && (
                        <a
                            href="https://github.com/apps/fern-api/installations/new"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary text-xs hover:underline"
                        >
                            Install Fern GitHub App →
                        </a>
                    )}
                </>
            )}

            <Button onClick={() => void handleSave()} disabled={!readyToSave} className="w-full">
                {saveButtonText}
            </Button>
        </div>
    );
}
