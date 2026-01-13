"use client";

import { Loader2 } from "lucide-react";

import type { GitRepoAccessCheckResult } from "@/app/api/validate-git-repo/handler";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DialogBody, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ConnectGitRepoParams } from "@/hooks/useConnectGitRepo";
import type { DocsUrl } from "@/utils/types";

import { ConfigurationCheckContent } from "./ConfigurationCheckContent";
import { ConnectGithubContent } from "./ConnectGithubContent";
import { InstallGithubAppContent } from "./InstallGithubAppContent";
import { SuccessContent } from "./SuccessContent";
import type { SetupState } from "./setupStateMachine";

interface FinishEditorSetupModalContentProps {
    state: SetupState;
    docsUrl: DocsUrl;
    pendingGithubUrl?: string;
    initialGitUrl?: string;
    orgName: Auth0OrgName;
    isLoadingInitialData: boolean;
    showRefreshButtonOnSuccess: boolean;
    accessCheckResult?: GitRepoAccessCheckResult;
    isAccessCheckLoading: boolean;
    isAccessCheckFetching: boolean;
    refetchAccessCheck: () => Promise<unknown>;
    onRepoConnected: (hasAppInstalled: boolean, githubUrl?: string) => void;
    onAppInstalled: () => void;
    onValidationError: () => void;
    connectRepo: (params: ConnectGitRepoParams) => Promise<{ success: boolean; gitUrl: string | undefined }>;
}

/**
 * Presentation component that renders the appropriate content based on the setup state.
 * This component is purely presentational and receives all state and callbacks via props.
 */
export function FinishEditorSetupModalContent({
    state,
    docsUrl,
    pendingGithubUrl,
    initialGitUrl,
    isLoadingInitialData,
    showRefreshButtonOnSuccess,
    accessCheckResult,
    isAccessCheckLoading,
    isAccessCheckFetching,
    refetchAccessCheck,
    onRepoConnected,
    onAppInstalled,
    onValidationError,
    connectRepo
}: FinishEditorSetupModalContentProps) {
    const isAccessCheckPending = isAccessCheckLoading || isAccessCheckFetching;

    // Show loading state while fetching initial data
    if (isLoadingInitialData) {
        return (
            <DialogBody>
                <DialogTitle />
                <DialogDescription />
                <div className="flex h-32 items-center justify-center gap-2 text-center">
                    <Loader2 className="size-4 animate-spin" />
                    <p className="text-muted-foreground text-xs">Gathering some ferns...</p>
                </div>
            </DialogBody>
        );
    }

    switch (state) {
        case "CONNECT_GITHUB":
            return (
                <ConnectGithubContent docsUrl={docsUrl} initialUrl={initialGitUrl} onRepoConnected={onRepoConnected} />
            );
        case "INSTALL_APP":
            return (
                <InstallGithubAppContent
                    pendingGithubUrl={pendingGithubUrl!}
                    accessCheckResult={accessCheckResult}
                    isCheckingAccess={isAccessCheckPending}
                    onAppInstalled={onAppInstalled}
                    connectRepo={connectRepo}
                />
            );

        case "VALIDATE_REPO":
        case "VALIDATION_ERROR":
            return (
                <ConfigurationCheckContent
                    onValidationError={onValidationError}
                    pendingGithubUrl={pendingGithubUrl!}
                    connectRepo={connectRepo}
                    accessCheckResult={accessCheckResult}
                    isCheckingAccess={isAccessCheckPending}
                    refetchAccessCheck={refetchAccessCheck}
                />
            );

        case "SUCCESS":
            return <SuccessContent showRefreshButton={showRefreshButtonOnSuccess} />;

        default:
            return null;
    }
}
