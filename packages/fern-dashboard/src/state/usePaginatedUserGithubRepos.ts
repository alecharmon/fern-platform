"use client";

import { useCallback, useEffect, useState } from "react";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { GithubRepo } from "@/app/services/github/types";

export interface PaginatedReposState {
  repos: GithubRepo[];
  isLoading: boolean;
  hasMore: boolean;
  error: Error | null;
}

export function usePaginatedUserGithubRepos(orgName: Auth0OrgName) {
  const [state, setState] = useState<PaginatedReposState>({
    repos: [],
    isLoading: false,
    hasMore: true,
    error: null,
  });

  const [currentPage, setCurrentPage] = useState(1);

  const loadPage = useCallback(
    async (page: number) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const response = await DashboardApiClient.getUserGithubRepos({
          orgName,
          page,
        });

        setState((prev) => ({
          repos:
            page === 1 ? response.repos : [...prev.repos, ...response.repos],
          isLoading: false,
          hasMore: response.hasMore,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          hasMore: false,
          error: error as Error,
        }));
      }
    },
    [orgName]
  );

  const loadNextPage = useCallback(() => {
    if (!state.isLoading && state.hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      void loadPage(nextPage);
    }
  }, [state.isLoading, state.hasMore, loadPage, currentPage]);

  const reset = useCallback(() => {
    setState({
      repos: [],
      isLoading: false,
      hasMore: true,
      error: null,
    });
    setCurrentPage(1);
    void loadPage(1);
  }, [loadPage]);

  // Load first page on mount
  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  return {
    ...state,
    loadNextPage,
    reset,
  };
}
