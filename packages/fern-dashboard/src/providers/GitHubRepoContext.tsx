"use client";

import { createContext, useContext } from "react";

import type { GithubSourceRepo } from "@/app/services/github/types";

interface GitHubRepoContextValue {
    branch: string;
    owner: string | undefined;
    repo: string | undefined;
    baseBranch: string | undefined;
    docsUrl: string;
}

const GitHubRepoContext = createContext<GitHubRepoContextValue | null>(null);

export function GitHubRepoProvider({
    children,
    branch,
    sourceRepo,
    docsUrl
}: {
    children: React.ReactNode;
    branch: string;
    sourceRepo: GithubSourceRepo;
    docsUrl: string;
}) {
    const { owner, repo, baseBranch } = sourceRepo;
    return (
        <GitHubRepoContext.Provider value={{ branch, owner, repo, baseBranch, docsUrl }}>
            {children}
        </GitHubRepoContext.Provider>
    );
}

/**
 * Preview-only version of GitHubRepoProvider that provides dummy context values.
 * Used when displaying docs in preview mode without GitHub integration.
 */
export function PreviewGitHubRepoProvider({
    children,
    branch,
    docsUrl
}: {
    children: React.ReactNode;
    branch: string;
    docsUrl: string;
}) {
    return (
        <GitHubRepoContext.Provider
            value={{
                branch,
                owner: undefined,
                repo: undefined,
                baseBranch: undefined,
                docsUrl
            }}
        >
            {children}
        </GitHubRepoContext.Provider>
    );
}

export function useGitHubRepo() {
    const context = useContext(GitHubRepoContext);
    if (!context) {
        throw new Error("useGitHubRepo must be used within a GitHubRepoProvider");
    }
    return context;
}
