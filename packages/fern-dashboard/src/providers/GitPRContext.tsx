"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";

export const GitPRContext = createContext<{
  gitPrUrl: string | undefined;
  setPrUrl: (url: string) => void;
  prTitle: string | undefined;
  setPrTitle: (title: string) => void;
  loading: boolean;
  refetchPrData: () => void;
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
});

export function GitPRProvider({
  children,
  owner,
  repo,
  branch,
  orgName,
  baseBranch,
}: {
  children: ReactNode;
  owner?: string;
  repo?: string;
  branch: string;
  orgName: Auth0OrgName;
  baseBranch?: string;
}) {
  const [gitPrUrl, setGitPrUrl] = useState<string | undefined>(undefined);
  const [prTitle, setPrTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPrFromBranch = useCallback(async () => {
    if (!owner || !repo || !branch) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await DashboardApiClient.getPrForBranch({
        owner,
        repo,
        branch,
        orgName,
        baseBranch,
      });

      if (data.success) {
        const serverTitle = data.title || "";
        setPrTitle(serverTitle);

        const prUrl = data.prUrl || "";
        setPrUrl(prUrl);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Error fetching PR for branch:", err);
    } finally {
      setIsLoading(false);
    }
  }, [owner, repo, branch, orgName, baseBranch]);

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

  return (
    <GitPRContext.Provider
      value={{
        gitPrUrl,
        setPrUrl,
        prTitle,
        setPrTitle,
        loading: isLoading,
        refetchPrData,
      }}
    >
      {children}
    </GitPRContext.Provider>
  );
}

export function useGitPrInfo() {
  return useContext(GitPRContext);
}
