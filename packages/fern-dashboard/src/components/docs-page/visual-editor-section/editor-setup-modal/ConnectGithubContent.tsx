"use client";

import { useMemo, useState } from "react";

import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useValidateGitRepo } from "@/hooks/useValidateGitRepo";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";

/**
 * Validates a git repository URL format on the client side.
 * Returns an error message if the URL is invalid, or null if it's valid.
 *
 * This catches common mistakes before making a server round-trip:
 * - Not a recognized git host (github.com, gitlab.com, or a URL with github/gitlab in it)
 * - Missing owner/repo in the URL path
 */
export function validateGitUrlFormat(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) {
        return null; // Don't show error for empty input
    }

    // Handle SSH URLs (git@host:owner/repo)
    const sshMatch = trimmed.match(/^git@[^:]+:(.+)/);
    if (sshMatch) {
        const pathStr = sshMatch[1]?.replace(/\.git$/, "") ?? "";
        const parts = pathStr.split("/").filter(Boolean);
        if (parts.length < 2) {
            return "Please enter a valid repository URL with owner and repo (e.g., git@github.com:owner/repo.git)";
        }
        return null;
    }

    // For HTTPS-style URLs, try to parse and validate
    try {
        const normalized = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
        const urlObj = new URL(normalized);
        const host = urlObj.host.toLowerCase();

        // Check if this looks like a git hosting provider
        const isGitHost =
            host === "github.com" ||
            host === "www.github.com" ||
            host === "gitlab.com" ||
            host === "www.gitlab.com" ||
            host.includes("github") ||
            host.includes("gitlab");

        if (!isGitHost) {
            return "Please enter a GitHub or GitLab repository URL (e.g., https://github.com/owner/repo)";
        }

        // Check for owner/repo in the path
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        if (pathParts.length < 2) {
            return "URL is missing the repository path. Expected format: https://github.com/owner/repo";
        }

        return null;
    } catch {
        return "Please enter a valid repository URL (e.g., https://github.com/owner/repo)";
    }
}

interface ConnectGithubContentProps {
    docsUrl: DocsUrl;
    initialUrl?: string;
    onRepoConnected: (hasAppInstalled: boolean, githubUrl?: string) => void;
}

export function ConnectGithubContent({ docsUrl, initialUrl, onRepoConnected }: ConnectGithubContentProps) {
    const [inputUrl, setInputUrl] = useState(initialUrl ?? "");
    const [submittedUrl, setSubmittedUrl] = useState<string>();
    const [hasBlurred, setHasBlurred] = useState(false);

    // Client-side URL format validation (runs on every input change)
    const clientValidationError = useMemo(() => validateGitUrlFormat(inputUrl), [inputUrl]);

    // Show client-side error after the user has interacted with the input (blurred or submitted)
    const showClientError = hasBlurred && !!inputUrl.trim() && !!clientValidationError;

    // Only validate after the user clicks Connect
    const { result: validationResult, loading: isValidating } = useValidateGitRepo({
        enabled: !!submittedUrl,
        docsUrl,
        gitUrl: submittedUrl
    });

    // Check if we have an error that should stay on this step (not actionable by user)
    // These are errors where the user cannot fix the issue themselves
    const errorType = validationResult?.ok === false ? validationResult.error.type : undefined;
    const stayOnInputErrors = [
        "MALFORMED_GIT_URL",
        "GITLAB_TOKEN_NOT_CONFIGURED",
        "GHE_APP_NOT_INSTALLED",
        "EDGE_CONFIG_ERROR"
    ];
    const hasBlockingError =
        submittedUrl &&
        validationResult &&
        !isValidating &&
        !validationResult.ok &&
        errorType &&
        stayOnInputErrors.includes(errorType);

    // Handle validation result - transition to next step unless it's a blocking error
    if (submittedUrl && validationResult && !isValidating && !hasBlockingError) {
        // URL is valid (recognized provider) - proceed to validation step
        // The validation step will handle all other errors (app not installed, config errors, etc.)
        const hasAppInstalled = validationResult.ok || validationResult.error.type !== "FERN_BOT_NOT_INSTALLED";
        onRepoConnected(hasAppInstalled, submittedUrl);
    }

    const handleConnect = () => {
        const trimmedUrl = inputUrl.trim();
        if (!trimmedUrl) {
            return;
        }

        // Block submission if client-side validation fails
        if (clientValidationError) {
            setHasBlurred(true); // Force showing the error
            return;
        }

        setSubmittedUrl(trimmedUrl);
    };

    const isConnecting = isValidating;
    const buttonLabel = isConnecting ? "Connecting..." : "Connect";

    // Determine which error to display (client-side takes priority when no server error)
    const displayError = hasBlockingError
        ? errorType === "MALFORMED_GIT_URL"
            ? "Please enter a valid GitHub or GitLab repository URL"
            : "Please contact Fern Support to set up this repository."
        : showClientError
          ? clientValidationError
          : null;

    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-primary flex items-center gap-2">Connect your repository</DialogTitle>
                <DialogDescription>
                    Editing made easy. Link your repository to your Fern site to enable your team to create pull
                    requests from the Fern Editor.
                </DialogDescription>
            </DialogHeader>
            <DialogBody>
                <div className="flex flex-col gap-2">
                    <Input
                        placeholder="https://github.com/example/repo"
                        value={inputUrl}
                        onChange={(e) => {
                            setInputUrl(e.target.value);
                            // Clear previous validation when user edits
                            if (submittedUrl) {
                                setSubmittedUrl(undefined);
                            }
                        }}
                        onBlur={() => setHasBlurred(true)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && inputUrl.trim() && !isConnecting) {
                                handleConnect();
                            }
                        }}
                        disabled={isConnecting}
                        autoFocus
                    />

                    {displayError && <div className="text-xs text-red-500 dark:text-red-600">{displayError}</div>}

                    <Button
                        onClick={handleConnect}
                        disabled={!inputUrl.trim() || isConnecting || !!clientValidationError}
                        className="w-full"
                    >
                        {buttonLabel}
                    </Button>
                </div>
            </DialogBody>
        </>
    );
}
