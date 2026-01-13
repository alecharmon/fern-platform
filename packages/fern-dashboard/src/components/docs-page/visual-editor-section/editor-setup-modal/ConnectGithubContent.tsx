"use client";

import { useState } from "react";

import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useValidateGitRepo } from "@/hooks/useValidateGitRepo";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";

interface ConnectGithubContentProps {
    docsUrl: DocsUrl;
    initialUrl?: string;
    onRepoConnected: (hasAppInstalled: boolean, githubUrl?: string) => void;
}

export function ConnectGithubContent({ docsUrl, initialUrl, onRepoConnected }: ConnectGithubContentProps) {
    const [inputUrl, setInputUrl] = useState(initialUrl ?? "");
    const [submittedUrl, setSubmittedUrl] = useState<string>();

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
        setSubmittedUrl(trimmedUrl);
    };

    const isConnecting = isValidating;
    const buttonLabel = isConnecting ? "Connecting..." : "Connect";

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
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && inputUrl.trim() && !isConnecting) {
                                handleConnect();
                            }
                        }}
                        disabled={isConnecting}
                        autoFocus
                    />

                    {hasBlockingError && (
                        <div className="text-xs text-red-500 dark:text-red-600">
                            {errorType === "MALFORMED_GIT_URL"
                                ? "Please enter a valid GitHub or GitLab repository URL"
                                : "Please contact Fern Support to set up this repository."}
                        </div>
                    )}

                    <Button onClick={handleConnect} disabled={!inputUrl.trim() || isConnecting} className="w-full">
                        {buttonLabel}
                    </Button>
                </div>
            </DialogBody>
        </>
    );
}
