"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { getPrForBranch } from "@/app/services/dal/github/getPrForBranch";
import type { GithubPrStatus } from "@/app/services/github/types";

/**
 * GitPRStatusContext contains PR status data that updates frequently.
 * Components that only need to read status can subscribe to this context
 * without re-rendering when config or actions change.
 */
export const GitPRStatusContext = createContext<{
    gitPrUrl: string | undefined;
    prTitle: string | undefined;
    loading: boolean;
    prStatus: GithubPrStatus | undefined;
    prNumber: number | undefined;
    isReadyForReview: boolean;
}>({
    gitPrUrl: undefined,
    prTitle: undefined,
    loading: false,
    prStatus: undefined,
    prNumber: undefined,
    isReadyForReview: false
});

/**
 * GitPRConfigContext contains stable configuration and action callbacks.
 * Components that only need config/actions can subscribe to this context
 * without re-rendering when status changes.
 */
export const GitPRConfigContext = createContext<{
    site: string;
    owner: string | undefined;
    repo: string | undefined;
    setPrUrl: (url: string) => void;
    setPrTitle: (title: string) => void;
    setPrStatus: (status: GithubPrStatus) => void;
    refetchPrData: () => void;
}>({
    site: "",
    owner: undefined,
    repo: undefined,
    setPrUrl: (_url: string) => {
        return;
    },
    setPrTitle: (_title: string) => {
        return;
    },
    setPrStatus: (_status: GithubPrStatus) => {
        return;
    },
    refetchPrData: () => {
        return;
    }
});

/**
 * Combined context type for backwards compatibility with useGitPrInfo().
 * This is used internally to provide both contexts' values.
 */
export const GitPRContext = createContext<{
    gitPrUrl: string | undefined;
    setPrUrl: (url: string) => void;
    prTitle: string | undefined;
    setPrTitle: (title: string) => void;
    loading: boolean;
    refetchPrData: () => void;
    prStatus: GithubPrStatus | undefined;
    setPrStatus: (status: GithubPrStatus) => void;
    prNumber: number | undefined;
    site: string;
    owner: string | undefined;
    repo: string | undefined;
    isReadyForReview: boolean;
}>({
    gitPrUrl: undefined,
    setPrUrl: (_url: string) => {
        return;
    },
    prTitle: undefined,
    setPrTitle: (_title: string) => {
        return;
    },
    loading: false,
    refetchPrData: () => {
        return;
    },
    prStatus: undefined,
    setPrStatus: (_status: GithubPrStatus) => {
        return;
    },
    isReadyForReview: false,
    prNumber: undefined,
    site: "",
    owner: undefined,
    repo: undefined
});

export function GitPRProvider({
    children,
    owner,
    repo,
    site,
    branch,
    baseBranch,
    gitUrl
}: {
    children: ReactNode;
    owner?: string;
    repo?: string;
    branch: string;
    site: string;
    baseBranch?: string;
    gitUrl?: string;
}) {
    const [gitPrUrl, setGitPrUrl] = useState<string | undefined>(undefined);
    const [prTitle, setPrTitle] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [prStatus, setPrStatus] = useState<GithubPrStatus | undefined>(undefined);
    const [prNumber, setPrNumber] = useState<number | undefined>(undefined);
    const orgName = useOrgName();

    const fetchPrFromBranch = useCallback(async () => {
        if (!owner || !repo || !branch) {
            // Set loading to false and status to draft for missing params
            setIsLoading(false);
            setPrStatus("draft");
            return;
        }

        setIsLoading(true);

        try {
            const data = await getPrForBranch(orgName, owner, repo, branch, baseBranch, gitUrl);

            if (data.success) {
                const { status, draft, merged, title, prUrl, prNumber: newPrNumber } = data;

                if (newPrNumber != null) {
                    setPrNumber(newPrNumber);
                }

                // Always update the PR title from the server
                if (title != null) {
                    setPrTitle(title);
                }

                // Always update the PR URL from the server
                if (prUrl != null) {
                    setGitPrUrl(prUrl);
                }

                if (merged) {
                    setPrStatus("merged");
                } else if (status === "closed") {
                    setPrStatus("closed");
                } else if (draft) {
                    setPrStatus("draft");
                } else {
                    setPrStatus("open");
                }
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            if (err instanceof Error && err.message.includes("No associated PRs found")) {
                console.debug("[fetchPrFromBranch] No associated PRs found for branch:", branch);
                // If no PRs are found, we'll pretend it's a draft PR because the first commit will open a draft PR
                setPrStatus("draft");
            } else {
                console.error("[fetchPrFromBranch] Error fetching PR for branch:", err);
                // Fallback to draft status on any error to prevent infinite loading
                setPrStatus("draft");
            }
        } finally {
            setIsLoading(false);
        }
    }, [owner, repo, branch, baseBranch, orgName, gitUrl]);

    // Fetch PR information when component mounts or dependencies change
    useEffect(() => {
        void fetchPrFromBranch();
    }, [fetchPrFromBranch]);

    const setPrUrl = useCallback((url: string) => {
        setGitPrUrl(url);
    }, []);

    const refetchPrData = useCallback(() => {
        void fetchPrFromBranch();
    }, [fetchPrFromBranch]);

    const isReadyForReview = useMemo(() => {
        return prStatus === "open";
    }, [prStatus]);

    // Memoized status context value - only changes when status-related values change
    const statusValue = useMemo(
        () => ({
            gitPrUrl,
            prTitle,
            loading: isLoading,
            prStatus,
            prNumber,
            isReadyForReview
        }),
        [gitPrUrl, prTitle, isLoading, prStatus, prNumber, isReadyForReview]
    );

    // Memoized config context value - only changes when config/actions change
    // Note: callbacks are stable due to useCallback, so this rarely changes
    const configValue = useMemo(
        () => ({
            site,
            owner,
            repo,
            setPrUrl,
            setPrTitle,
            setPrStatus,
            refetchPrData
        }),
        [site, owner, repo, setPrUrl, refetchPrData]
    );

    // Combined value for backwards compatibility
    const combinedValue = useMemo(
        () => ({
            ...statusValue,
            ...configValue
        }),
        [statusValue, configValue]
    );

    return (
        <GitPRConfigContext.Provider value={configValue}>
            <GitPRStatusContext.Provider value={statusValue}>
                <GitPRContext.Provider value={combinedValue}>{children}</GitPRContext.Provider>
            </GitPRStatusContext.Provider>
        </GitPRConfigContext.Provider>
    );
}

/**
 * Preview-only version of GitPRProvider that provides dummy context values.
 * Used when displaying docs in preview mode without GitHub integration.
 */
export function PreviewGitPRProvider({ children, site }: { children: ReactNode; site: string }) {
    const statusValue = useMemo(
        () => ({
            gitPrUrl: undefined,
            prTitle: undefined,
            loading: false,
            prStatus: "preview" as const,
            prNumber: undefined,
            isReadyForReview: false
        }),
        []
    );

    const configValue = useMemo(
        () => ({
            site,
            owner: undefined,
            repo: undefined,
            setPrUrl: () => undefined,
            setPrTitle: () => undefined,
            setPrStatus: () => undefined,
            refetchPrData: () => undefined
        }),
        [site]
    );

    const combinedValue = useMemo(
        () => ({
            ...statusValue,
            ...configValue
        }),
        [statusValue, configValue]
    );

    return (
        <GitPRConfigContext.Provider value={configValue}>
            <GitPRStatusContext.Provider value={statusValue}>
                <GitPRContext.Provider value={combinedValue}>{children}</GitPRContext.Provider>
            </GitPRStatusContext.Provider>
        </GitPRConfigContext.Provider>
    );
}

/**
 * Hook to access all Git PR info (backwards compatible).
 * Use useGitPrStatus() or useGitPrConfig() for more granular subscriptions.
 */
export function useGitPrInfo() {
    return useContext(GitPRContext);
}

/**
 * Hook to access only PR status data.
 * Components using this hook won't re-render when config/actions change.
 */
export function useGitPrStatus() {
    return useContext(GitPRStatusContext);
}

/**
 * Hook to access only PR config and actions.
 * Components using this hook won't re-render when status changes.
 */
export function useGitPrConfig() {
    return useContext(GitPRConfigContext);
}
