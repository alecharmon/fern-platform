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
            return;
        }

        setIsLoading(true);

        try {
            const data = await getPrForBranch(orgName, owner, repo, branch, baseBranch);

            if (data.success) {
                const { status, draft, merged, title, prUrl, prNumber: newPrNumber } = data;

                if (newPrNumber && newPrNumber !== prNumber) {
                    setPrNumber(newPrNumber);
                }

                // Update the PR title if it has changed
                if (title && title !== prTitle) {
                    setPrTitle(title);
                }

                // Update the PR URL if it has changed
                if (prUrl && prUrl !== gitPrUrl) {
                    setPrUrl(prUrl);
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
                // If no PRs are found, we'll pretend it's a draft PR because the first commit will open a draft PR
                setPrStatus("draft");
            } else {
                console.error("Error fetching PR for branch:", err);
            }
        } finally {
            setIsLoading(false);
        }
    }, [owner, repo, site, branch, baseBranch, prNumber, prTitle, gitPrUrl, orgName]);

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

export function useGitPrInfo() {
    return useContext(GitPRContext);
}
