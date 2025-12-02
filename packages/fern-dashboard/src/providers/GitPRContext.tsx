"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { getPrForBranch } from "@/app/services/dal/github/getPrForBranch";
import type { GithubPrStatus } from "@/app/services/github/types";

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
    baseBranch
}: {
    children: ReactNode;
    owner?: string;
    repo?: string;
    branch: string;
    site: string;
    baseBranch?: string;
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
            const data = await getPrForBranch(orgName, owner, repo, branch, baseBranch);

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
    }, [owner, repo, branch, baseBranch, orgName]);

    // Fetch PR information when component mounts or dependencies change
    useEffect(() => {
        void fetchPrFromBranch();
    }, [fetchPrFromBranch]);

    function setPrUrl(url: string) {
        setGitPrUrl(url);
    }

    const refetchPrData = useCallback(() => {
        void fetchPrFromBranch();
    }, [fetchPrFromBranch]);

    const isReadyForReview = useMemo(() => {
        return prStatus === "open";
    }, [prStatus]);

    return (
        <GitPRContext.Provider
            value={{
                prNumber,
                gitPrUrl,
                setPrUrl,
                prTitle,
                setPrTitle,
                loading: isLoading,
                refetchPrData,
                prStatus,
                setPrStatus,
                site,
                owner,
                repo,
                isReadyForReview
            }}
        >
            {children}
        </GitPRContext.Provider>
    );
}

/**
 * Preview-only version of GitPRProvider that provides dummy context values.
 * Used when displaying docs in preview mode without GitHub integration.
 */
export function PreviewGitPRProvider({ children, site }: { children: ReactNode; site: string }) {
    return (
        <GitPRContext.Provider
            value={{
                gitPrUrl: undefined,
                setPrUrl: () => undefined,
                prTitle: undefined,
                setPrTitle: () => undefined,
                loading: false,
                refetchPrData: () => undefined,
                prStatus: "preview",
                setPrStatus: () => undefined,
                prNumber: undefined,
                site,
                owner: undefined,
                repo: undefined,
                isReadyForReview: false
            }}
        >
            {children}
        </GitPRContext.Provider>
    );
}

export function useGitPrInfo() {
    return useContext(GitPRContext);
}
