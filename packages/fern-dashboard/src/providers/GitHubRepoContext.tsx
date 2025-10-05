"use client";

import { createContext, useContext } from "react";

import type { GithubSourceRepo } from "@/app/services/github/types";

interface GitHubRepoContextValue {
    branch: string;
    owner: string | undefined;
    repo: string | undefined;
    baseBranch: string | undefined;
}

const GitHubRepoContext = createContext<GitHubRepoContextValue | null>(null);

export function GitHubRepoProvider({
    children,
    branch,
    sourceRepo
}: {
    children: React.ReactNode;
    branch: string;
    sourceRepo: GithubSourceRepo;
}) {
    const { owner, repo, baseBranch } = sourceRepo;
    return (
        <GitHubRepoContext.Provider value={{ branch, owner, repo, baseBranch }}>{children}</GitHubRepoContext.Provider>
    );
}

export function useGitHubRepo() {
    const context = useContext(GitHubRepoContext);
    if (!context) {
        throw new Error("useGitHubRepo must be used within a GitHubRepoProvider");
    }
    return context;
}
