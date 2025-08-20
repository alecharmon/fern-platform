import { useCallback, useMemo, useState } from "react";

import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { validateUrlIsGithubUrl } from "@/app/services/github/github";
import { ReactQueryKey } from "@/state/queryKeys";
import { DocsUrl } from "@/utils/types";

import {
  ErrorEditSourceToast,
  SuccessfulEditSourceToast,
} from "../editor/EditorToasts";
import { Button } from "../ui/button";
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
  const [inputUrl, setInputUrl] = useState("");

  const queryClient = useQueryClient();

  const handleConnectRepo = useCallback(
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

        setInputUrl("");
      } catch (e) {
        ErrorEditSourceToast();
        console.error(e);
      } finally {
        setIsSaving(false);
      }
    },
    [docsUrl, queryClient, setIsSaving]
  );

  const inputUrlIsGithubUrl = useMemo(() => {
    if (inputUrl === "") {
      return true; // Don't validate empty input
    }
    return validateUrlIsGithubUrl(inputUrl);
  }, [inputUrl]);

  return (
    <Popover
      open={isPopoverOpen}
      onOpenChange={(open) => {
        setIsPopoverOpen(open);
        if (!open) {
          setInputUrl("");
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="border-border w-80 rounded-xl border p-0"
        align="start"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2 p-2">
            <div className="border-border flex flex-1 items-center rounded-md border pr-0.5">
              <Input
                placeholder="Paste Github URL..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleConnectRepo(inputUrl);
                  }
                }}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
              />
              {!inputUrlIsGithubUrl && (
                <ExclamationCircleIcon className="size-4" />
              )}
            </div>
            <Button onClick={() => void handleConnectRepo(inputUrl)}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
