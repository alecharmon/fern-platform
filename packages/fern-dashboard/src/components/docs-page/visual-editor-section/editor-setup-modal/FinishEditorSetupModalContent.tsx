"use client";

import { Loader2 } from "lucide-react";
import type { ValidateGithubRepoAccessResponse } from "@/app/api/validate-github-repo-access/handler";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DialogBody, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ConnectGithubRepoParams } from "@/hooks/useConnectGithubRepo";
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
    orgName: Auth0OrgName;
    isLoadingInitialData: boolean;
    showRefreshButtonOnSuccess: boolean;
    accessCheckResult?: ValidateGithubRepoAccessResponse;
    isAccessCheckLoading: boolean;
    isAccessCheckFetching: boolean;
    refetchAccessCheck: () => Promise<unknown>;
    onRepoConnected: (hasAppInstalled: boolean, githubUrl?: string) => void;
    onAppInstalled: () => void;
    onValidationError: () => void;
    connectRepo: (params: ConnectGithubRepoParams) => Promise<{ success: boolean; githubUrl: string | undefined }>;
}

/**
 * Presentation component that renders the appropriate content based on the setup state.
 * This component is purely presentational and receives all state and callbacks via props.
 */
export function FinishEditorSetupModalContent({
    state,
    docsUrl,
    pendingGithubUrl,
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
                <div className="h-32 flex gap-2 justify-center items-center text-center">
                    <Loader2 className="size-4 animate-spin" />
                    <p className="text-muted-foreground text-xs">Gathering some ferns...</p>
                </div>
            </DialogBody>
        );
    }

    switch (state) {
        case "CONNECT_GITHUB":
            return (
                <ConnectGithubContent docsUrl={docsUrl} connectRepo={connectRepo} onRepoConnected={onRepoConnected} />
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
