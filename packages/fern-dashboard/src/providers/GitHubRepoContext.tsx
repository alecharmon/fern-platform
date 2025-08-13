"use client";

import { createContext, useContext } from "react";

interface GitHubRepoContextValue {
  owner: string;
  repo: string;
  branch: string;
}

const GitHubRepoContext = createContext<GitHubRepoContextValue | null>(null);

export function GitHubRepoProvider({
  children,
  owner,
  repo,
  branch,
}: {
  children: React.ReactNode;
  owner: string;
  repo: string;
  branch: string;
}) {
  return (
    <GitHubRepoContext.Provider value={{ owner, repo, branch }}>
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
