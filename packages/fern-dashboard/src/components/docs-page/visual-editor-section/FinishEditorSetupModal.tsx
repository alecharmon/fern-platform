"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import { useConfetti } from "@/hooks/useConfetti";
import { useConnectGithubRepo } from "@/hooks/useConnectGithubRepo";
import { useValidateGithubRepo } from "@/hooks/useValidateGithubRepo";
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
}

/**
 * Container component for the editor setup modal.
 * Manages modal state, fetches GitHub metadata, and orchestrates the setup flow.
 */
export function FinishEditorSetupModal({
    orgName,
    docsUrl,
    trigger,
    showRefreshButtonOnSuccess
}: FinishEditorSetupModalProps) {
    return (
        <EditorSetupModalImpl
            docsUrl={docsUrl}
            orgName={orgName}
            trigger={trigger}
            isLoadingInitialData={false}
            showRefreshButtonOnSuccess={showRefreshButtonOnSuccess}
        />
    );
}

function EditorSetupModalImpl({
    docsUrl,
    orgName,
    trigger,
    isLoadingInitialData,
    showRefreshButtonOnSuccess = false
}: {
    isLoadingInitialData: boolean;
} & FinishEditorSetupModalProps) {
    const [githubUrl, setGithubUrl] = useState<string>();

    const [open, setOpen] = useState(false);
    const { startConfetti } = useConfetti();

    const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl ?? "");
    const shouldEnableAccessCheck = open && !!owner && !!repo;

    const {
        result: accessCheckResult,
        loading: isLoadingValidation,
        fetching: isFetchingValidation,
        refetch: refetchAccessCheck
    } = useValidateGithubRepo({
        enabled: shouldEnableAccessCheck,
        docsUrl,
        owner: owner ?? undefined,
        repo: repo ?? undefined,
        refetchInterval: shouldEnableAccessCheck ? 3000 : false
    });

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
        isRepoConnected: !!githubUrl,
        isAppInstalled: accessCheckResult?.appInstalled === true,
        isLoadingInitialData: isLoadingValidation || isLoadingInitialData,
        hasValidationError: !!accessCheckResult && !accessCheckResult.ok
    });

    const onReset = () => {
        setGithubUrl(undefined);
        handleReset();
    };

    // Wrap handleRepoConnected to capture the GitHub URL
    const handleRepoConnected = useCallback(
        (hasAppInstalled: boolean, newGithubUrl?: string) => {
            if (newGithubUrl && newGithubUrl !== githubUrl) {
                setGithubUrl(newGithubUrl);
            }
            handleRepoConnectedBase(hasAppInstalled);
        },
        [handleRepoConnectedBase, githubUrl]
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
    }, [startConfetti, showRefreshButtonOnSuccess]);

    // Centralized hook for connecting GitHub repo
    // All success paths in the modal use this hook's callbacks
    const { connectRepo } = useConnectGithubRepo({
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
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="default" size="default">
                        Connect repo
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="md:max-w-md">
                <FinishEditorSetupModalContent
                    state={state}
                    docsUrl={docsUrl}
                    pendingGithubUrl={githubUrl}
                    orgName={orgName}
                    isLoadingInitialData={isLoadingValidation || isLoadingInitialData}
                    accessCheckResult={accessCheckResult ?? undefined}
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
