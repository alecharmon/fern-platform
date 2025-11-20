"use client";

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import updatePrStatus, { type UpdatePrStatusErrors } from "@/app/services/dal/github/updatePrStatus";
import type { GithubPrStatus } from "@/app/services/github/types";
import { ErrorUpdatePrStatusToast } from "@/components/editor/EditorToasts";
import { useBranch } from "@/providers/BranchContext";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import { useGitPrInfo } from "@/providers/GitPRContext";

interface UpdatePRStatusParams {
    owner: string;
    repo: string;
    branch: string;
    status: "open" | "draft";
    baseBranch?: string;
    orgName: Auth0OrgName;
    site: string;
}

type UpdatePRStatusResult =
    | {
          success: true;
          status?: GithubPrStatus;
          prNumber?: number;
          prUrl?: string;
      }
    | {
          success: false;
          error: UpdatePrStatusErrors;
      };

function useUpdatePRStatusMutation(): UseMutationResult<UpdatePRStatusResult, Error, UpdatePRStatusParams> {
    return useMutation({
        mutationFn: async (params: UpdatePRStatusParams) => {
            return updatePrStatus(params);
        },
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
    });
}

export function useUpdatePrStatus() {
    const { prStatus, setPrStatus, site, gitPrUrl } = useGitPrInfo();
    const { branch } = useBranch();
    const { owner, repo, baseBranch } = useGitHubRepo();

    const orgName = useOrgName();

    const updatePrStatusMutation = useUpdatePRStatusMutation();

    const updatePrStatus = useCallback(
        async (newStatus: GithubPrStatus) => {
            // Don't update if same status or if we don't have required data
            if (newStatus === prStatus || !owner || !repo || !branch || !gitPrUrl) {
                return;
            }

            // We only support changing between ready (open) and draft
            if (newStatus !== "open" && newStatus !== "draft") {
                return;
            }

            try {
                const result = await updatePrStatusMutation.mutateAsync({
                    orgName,
                    owner,
                    repo,
                    site,
                    branch,
                    status: newStatus,
                    baseBranch
                });

                if (result.success && result.status) {
                    setPrStatus(result.status);
                } else {
                    ErrorUpdatePrStatusToast();
                }
            } catch (err) {
                ErrorUpdatePrStatusToast();
                console.error("Error updating PR status:", err);
            }
        },
        [owner, repo, branch, site, prStatus, gitPrUrl, setPrStatus, baseBranch, orgName, updatePrStatusMutation]
    );

    return { updatePrStatus, loading: updatePrStatusMutation.isPending };
}
