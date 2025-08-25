"use client";

import { useCallback, useState } from "react";

import { ChevronDownIcon } from "lucide-react";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { GithubPrStatus } from "@/app/services/github/types";
import { useGitPrInfo } from "@/providers/GitPRContext";

import { StatusBadge } from "../ui/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { ErrorUpdatePrStatusToast } from "./EditorToasts";

interface PRStatusDropdownProps {
  owner: string | undefined;
  repo: string | undefined;
  branch: string | null;
  gitPrUrl: string | undefined;
  baseBranch?: string;
}

export function PRStatusDropdown({
  owner,
  repo,
  branch,
  gitPrUrl,
  baseBranch,
}: PRStatusDropdownProps) {
  const { prStatus, setPrStatus, loading } = useGitPrInfo();
  const orgName = useOrgName();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = useCallback(
    async (newStatus: GithubPrStatus) => {
      // Don't update if same status or if we don't have required data
      if (newStatus === prStatus || !owner || !repo || !branch || !gitPrUrl) {
        return;
      }

      // We only support changing between ready (open) and draft
      if (newStatus !== "open" && newStatus !== "draft") {
        return;
      }

      setIsUpdating(true);

      try {
        const data = await DashboardApiClient.updatePrStatus({
          orgName,
          owner,
          repo,
          branch,
          status: newStatus,
          baseBranch,
        });

        if (data.success && data.status) {
          setPrStatus(data.status);
        } else {
          ErrorUpdatePrStatusToast();
        }
      } catch (err) {
        ErrorUpdatePrStatusToast();
        console.error("Error updating PR status:", err);
      } finally {
        setIsUpdating(false);
      }
    },
    [owner, repo, branch, prStatus, gitPrUrl, setPrStatus, baseBranch, orgName]
  );

  // If the PR does not yet exist, we'll pretend it's a draft
  if (!loading && !gitPrUrl) {
    return <StatusBadge status="draft" />;
  }

  // Show badge for merged and closed PRs, dropdown for others
  if (prStatus === "merged") {
    return <StatusBadge status="merged" />;
  } else if (prStatus === "closed") {
    return <StatusBadge status="closed" />;
  }

  const isDisabled = loading || isUpdating || !gitPrUrl;

  return (
    <Select
      value={prStatus}
      onValueChange={(value) =>
        void handleStatusChange(value as GithubPrStatus)
      }
      disabled={isDisabled}
    >
      <SelectTrigger
        className="border-none px-0 shadow-none focus-visible:ring-0"
        asChild
      >
        <StatusBadge
          status={prStatus || "loading"}
          afterSlot={
            !loading && <ChevronDownIcon className="size-4 opacity-50" />
          }
        />
      </SelectTrigger>
      <SelectContent className="space-y-2 border-gray-500 px-0" checkOnLeft>
        <SelectItem value="draft">
          <StatusBadge status="draft" />
        </SelectItem>
        <SelectItem value="open">
          <StatusBadge status="open" />
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
