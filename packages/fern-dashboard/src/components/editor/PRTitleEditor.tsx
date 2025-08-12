"use client";

import { useCallback, useState } from "react";

import { GitPullRequest, Loader2 } from "lucide-react";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { Input } from "@/components/ui/input";
import { useGitPrInfo } from "@/providers/GitPRContext";

import { ErrorUpdatePrTitleToast } from "./EditorToasts";

interface PRTitleEditorProps {
  orgName: Auth0OrgName;
  owner: string | undefined;
  repo: string | undefined;
  branch: string | null;
  gitPrUrl: string | undefined;
  baseBranch?: string;
}

export function PRTitleEditor({
  orgName,
  owner,
  repo,
  branch,
  gitPrUrl,
  baseBranch,
}: PRTitleEditorProps) {
  const { prTitle: serverTitle, setPrTitle, loading } = useGitPrInfo();
  const [localTitle, setLocalTitle] = useState<string>(serverTitle ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(
    async (newTitle: string) => {
      const trimmedTitle = newTitle.trim();

      // If the local title is the same as the server title, don't update it
      if (trimmedTitle === serverTitle?.trim()) {
        return;
      }

      setLocalTitle(trimmedTitle);
      setIsEditing(false);

      // If no PR exists yet, just save to parent state
      if (!gitPrUrl || !owner || !repo || !branch) {
        setPrTitle(trimmedTitle);
        return;
      }

      setIsSaving(true);

      try {
        const data = await DashboardApiClient.updatePrTitle({
          owner,
          repo,
          branch,
          title: trimmedTitle,
          orgName,
          baseBranch,
        });

        if (data.success) {
          setPrTitle(data.title || trimmedTitle);
        } else {
          ErrorUpdatePrTitleToast();
        }
      } catch (err) {
        ErrorUpdatePrTitleToast();
        console.error("Error updating PR title:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [
      owner,
      repo,
      branch,
      orgName,
      serverTitle,
      gitPrUrl,
      setLocalTitle,
      setPrTitle,
      baseBranch,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSave(e.currentTarget.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsEditing(false);
        e.currentTarget.value = localTitle;
      }
    },
    [handleSave, localTitle]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(false);
      void handleSave(e.currentTarget.value);
    },
    [handleSave]
  );

  return (
    <div className="flex w-fit items-center gap-1">
      <GitPullRequest className="text-muted-foreground size-4" />
      {loading ? (
        <p className="px-2 text-gray-600">Loading title...</p>
      ) : isEditing ? (
        <Input
          autoFocus
          disabled={isSaving}
          defaultValue={localTitle || serverTitle}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="text-muted-foreground h-8 min-w-[300px] flex-1"
          placeholder="Enter PR title..."
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="text-muted-foreground flex-1 rounded-md p-1 px-2 text-left transition-colors hover:bg-gray-300 hover:transition-none"
          disabled={isSaving}
        >
          <p className="flex items-center gap-1 truncate">
            {localTitle || serverTitle || "Click to edit PR title"}
            {isSaving && <Loader2 className="ml-2 size-4 animate-spin" />}
          </p>
        </button>
      )}
    </div>
  );
}
