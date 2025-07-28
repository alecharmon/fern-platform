import { useCallback, useEffect, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";

import { truncateString } from "@fern-api/docs-utils";
import { FernImage } from "@fern-docs/components/FernImage";
import { useDebouncedCallback } from "@fern-ui/react-commons";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { ReactQueryKey } from "@/state/queryKeys";
import { usePaginatedUserGithubRepos } from "@/state/usePaginatedUserGithubRepos";
import { DocsUrl } from "@/utils/types";

import {
  ErrorEditSourceToast,
  SuccessfulEditSourceToast,
} from "../editor/EditorToasts";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export function SetGithubSourcePopover({
  docsUrl,
  children,
  setIsSaving,
}: {
  docsUrl: DocsUrl;
  children: React.ReactNode;
  setIsSaving: (isSaving: boolean) => void;
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { repos, isLoading, hasMore, loadNextPage } =
    usePaginatedUserGithubRepos();
  const queryClient = useQueryClient();

  // Note: this was vibe-coded until the search felt about right in terms of responsiveness
  // Memoize filtered and sorted repos to avoid recalculation on every render
  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) {
      return repos.slice(0, 20); // Show first 20 repos when no search
    }

    const query = searchQuery.toLowerCase();

    // Pre-compute lowercase values once
    const reposWithLowercase = repos.map((repo) => ({
      ...repo,
      nameLower: repo.name.toLowerCase(),
      urlLower: repo.url?.toLowerCase() || "",
    }));

    return reposWithLowercase
      .filter(
        (repo) =>
          repo.nameLower.includes(query) || repo.urlLower.includes(query)
      )
      .sort((a, b) => {
        const aNameContains = a.nameLower.includes(query);
        const bNameContains = b.nameLower.includes(query);
        const aStartsWith = a.nameLower.startsWith(query);
        const bStartsWith = b.nameLower.startsWith(query);

        // Prioritize names that start with query
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // Then prioritize names that contain query
        if (aNameContains && !bNameContains) return -1;
        if (!aNameContains && bNameContains) return 1;

        // Then sort alphabetically
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50); // Limit results for better performance
  }, [repos, searchQuery]);

  const debouncedSetSearchQuery = useDebouncedCallback(
    (value: string) => setSearchQuery(value),
    [setSearchQuery],
    150
  );

  // Load more repos when needed (only when search is empty or results are low)
  const shouldLoadMore = useMemo(() => {
    if (isLoading || !hasMore) return false;
    if (!searchQuery.trim()) return repos.length < 20; // Show first 20 repos when no search (for better UX)
    return filteredRepos.length < 10;
  }, [isLoading, hasMore, searchQuery, repos.length, filteredRepos.length]);

  // Load more repos when needed
  useEffect(() => {
    if (shouldLoadMore) {
      loadNextPage();
    }
  }, [shouldLoadMore, loadNextPage]);

  const handleRepoSelect = useCallback(
    async (repoUrl: string) => {
      try {
        setIsSaving(true);
        setIsPopoverOpen(false);
        await DashboardApiClient.postDocsGithubSource({
          url: docsUrl,
          githubUrl: repoUrl,
        });

        // Invalidate the github source repo query so that we can see the new repo
        await queryClient.invalidateQueries({
          queryKey: ReactQueryKey.githubSourceRepo(docsUrl),
        });

        SuccessfulEditSourceToast();

        setSearchQuery("");
      } catch (e) {
        ErrorEditSourceToast();
        console.error(e);
      } finally {
        setIsSaving(false);
      }
    },
    [docsUrl, queryClient, setIsSaving]
  );

  const searchQueryIsUrl = useMemo(() => {
    return (
      searchQuery.startsWith("https://") || searchQuery.startsWith("http://")
    );
  }, [searchQuery]);

  return (
    <Popover
      open={isPopoverOpen}
      onOpenChange={(open) => {
        setIsPopoverOpen(open);
        if (!open) {
          setSearchQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="border-border w-80 border p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center border-b p-2">
            <div className="border-border flex flex-1 items-center rounded-md border px-3">
              <SearchIcon className="h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder="Enter URL or search repositories..."
                onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredRepos.length === 0 ? (
              <>
                {searchQueryIsUrl ? (
                  <button
                    onClick={() => void handleRepoSelect(searchQuery)}
                    className="hover:bg-accent hover:text-primary m-1 cursor-pointer break-all rounded-md px-2 py-1 text-sm text-gray-800"
                  >
                    + Use {searchQuery};
                  </button>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    {isLoading
                      ? "Loading repositories..."
                      : searchQuery
                        ? "No repositories found"
                        : "No repositories available"}
                  </div>
                )}
              </>
            ) : (
              <>
                {filteredRepos.map((repo) => (
                  <div
                    key={`${repo.url}-${repo.name}`}
                    className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <button
                      className="flex items-start gap-2"
                      onClick={() => void handleRepoSelect(repo.url)}
                    >
                      <FernImage
                        src={repo.avatarUrl}
                        alt={repo.name}
                        className="mt-1 size-6 rounded-sm border p-[2px]"
                      />
                      <div className="flex flex-col text-left">
                        <p className="font-medium">{repo.name}</p>
                        <p className="text-xs text-gray-900">
                          {[
                            truncateString(repo.description ?? "", 70),
                            repo.owner,
                            repo.stargazersCount
                              ? `${repo.stargazersCount} stars`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                    </button>
                  </div>
                ))}
                {isLoading && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Loading more repositories...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
