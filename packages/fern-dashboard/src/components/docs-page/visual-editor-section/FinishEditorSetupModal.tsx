"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { useConfetti } from "@/hooks/useConfetti";
import { useConnectGitRepo } from "@/hooks/useConnectGitRepo";
import { useValidateGitRepo } from "@/hooks/useValidateGitRepo";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "../../ui/dialog";
import { FinishEditorSetupModalContent } from "./editor-setup-modal/FinishEditorSetupModalContent";
import { useEditorSetupState } from "./editor-setup-modal/useEditorSetupState";

interface FinishEditorSetupModalProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    trigger?: React.ReactNode;
    showRefreshButtonOnSuccess?: boolean;
    initialGitUrl?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    autoSubmitInitialUrl?: boolean;
}

/**
 * Container component for the editor setup modal.
 * Manages modal state, fetches GitHub metadata, and orchestrates the setup flow.
 */
export function FinishEditorSetupModal({
    orgName,
    docsUrl,
    trigger,
    showRefreshButtonOnSuccess,
    initialGitUrl,
    open,
    onOpenChange,
    autoSubmitInitialUrl
}: FinishEditorSetupModalProps) {
    return (
        <EditorSetupModalImpl
            docsUrl={docsUrl}
            orgName={orgName}
            trigger={trigger}
            isLoadingInitialData={false}
            showRefreshButtonOnSuccess={showRefreshButtonOnSuccess}
            initialGitUrl={initialGitUrl}
            open={open}
            onOpenChange={onOpenChange}
            autoSubmitInitialUrl={autoSubmitInitialUrl}
        />
    );
}

function EditorSetupModalImpl({
    docsUrl,
    orgName,
    trigger,
    isLoadingInitialData,
    showRefreshButtonOnSuccess = false,
    initialGitUrl,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    autoSubmitInitialUrl = false
}: {
    isLoadingInitialData: boolean;
} & FinishEditorSetupModalProps) {
    // gitUrl tracks the URL being validated/connected - separate from initialGitUrl which just prepopulates the input
    const [gitUrl, setGitUrl] = useState<string | undefined>();
    const [detectedProvider, setDetectedProvider] = useState<string>();
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);

    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

    const { startConfetti } = useConfetti();

    const shouldEnableAccessCheck = open && !!gitUrl;

    // Use the unified validation hook - provider detection happens server-side
    // Only poll for github.com repos (once we know the provider)
    const {
        result: validationResult,
        loading: isLoadingValidation,
        fetching: isFetchingValidation,
        refetch: refetchAccessCheck
    } = useValidateGitRepo({
        enabled: shouldEnableAccessCheck,
        docsUrl,
        gitUrl,
        refetchInterval: shouldEnableAccessCheck && detectedProvider === "github" ? 3000 : false
    });

    // Track the detected provider when validation result changes
    useEffect(() => {
        if (validationResult?.provider) {
            setDetectedProvider(validationResult.provider);
        }
    }, [validationResult?.provider]);

    // Auto-submit the initial URL when the modal opens with autoSubmitInitialUrl=true
    // This skips the first step and goes directly to validation
    useEffect(() => {
        if (open && autoSubmitInitialUrl && initialGitUrl && !hasAutoSubmitted) {
            setGitUrl(initialGitUrl);
            setHasAutoSubmitted(true);
        }
        // Reset hasAutoSubmitted when modal closes
        if (!open && hasAutoSubmitted) {
            setHasAutoSubmitted(false);
        }
    }, [open, autoSubmitInitialUrl, initialGitUrl, hasAutoSubmitted]);

    // Convert the new response format to the format expected by child components
    const accessCheckResult = validationResult
        ? validationResult.ok
            ? { ok: true as const, appInstalled: true as const }
            : {
                  ok: false as const,
                  appInstalled: validationResult.error.type !== "FERN_BOT_NOT_INSTALLED",
                  error: validationResult.error
              }
        : undefined;

    // Manage the setup state machine
    const {
        state,
        handleRepoConnected: handleRepoConnectedBase,
        handleAppInstalled,
        handleValidationSuccess,
        handleValidationError,
        handleReset
    } = useEditorSetupState({
        isOpen: open,
        isRepoConnected: !!gitUrl,
        isAppInstalled: accessCheckResult?.appInstalled ?? true,
        isLoadingInitialData: isLoadingValidation || isLoadingInitialData,
        hasValidationError: !!accessCheckResult && !accessCheckResult.ok
    });

    const onReset = () => {
        setGitUrl(undefined);
        handleReset();
    };

    // Wrap handleRepoConnected to capture the GitHub URL
    const handleRepoConnected = useCallback(
        (hasAppInstalled: boolean, newGithubUrl?: string) => {
            if (newGithubUrl && newGithubUrl !== gitUrl) {
                setGitUrl(newGithubUrl);
            }
            handleRepoConnectedBase(hasAppInstalled);
        },
        [handleRepoConnectedBase, gitUrl]
    );

    const onSuccess = useCallback(() => {
        startConfetti();

        // Auto-close if we don't have anything to show on success
        let timeout: NodeJS.Timeout;
        if (!showRefreshButtonOnSuccess) {
            timeout = setTimeout(() => {
                setOpen(false);
            }, 2000);
        }
        return () => clearTimeout(timeout);
    }, [startConfetti, showRefreshButtonOnSuccess, setOpen]);

    // Centralized hook for connecting GitHub repo
    // All success paths in the modal use this hook's callbacks
    const { connectRepo } = useConnectGitRepo({
        docsUrl,
        showSuccessToast: false,
        onSuccess: () => {
            handleValidationSuccess();
        }
    });

    // Handle SUCCESS state
    useEffect(() => {
        if (state === "SUCCESS" && open) {
            onSuccess();
        }
    }, [state, open, onSuccess]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    {trigger ?? (
                        <Button variant="default" size="default">
                            Connect repo
                        </Button>
                    )}
                </DialogTrigger>
            )}
            <DialogContent className="md:max-w-md">
                <FinishEditorSetupModalContent
                    state={state}
                    docsUrl={docsUrl}
                    pendingGithubUrl={gitUrl}
                    initialGitUrl={initialGitUrl}
                    orgName={orgName}
                    isLoadingInitialData={isLoadingValidation || isLoadingInitialData}
                    accessCheckResult={accessCheckResult}
                    isAccessCheckLoading={isLoadingValidation}
                    isAccessCheckFetching={isFetchingValidation}
                    refetchAccessCheck={refetchAccessCheck}
                    onRepoConnected={handleRepoConnected}
                    onAppInstalled={handleAppInstalled}
                    onValidationError={handleValidationError}
                    connectRepo={connectRepo}
                    showRefreshButtonOnSuccess={showRefreshButtonOnSuccess}
                />
                {state !== "CONNECT_GITHUB" && state !== "SUCCESS" && (
                    <DialogFooter className="justify-start p-3">
                        <Button variant="ghost" onClick={onReset}>
                            <ArrowLeft className="size-4" />
                            Connect a different GitHub repo
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
