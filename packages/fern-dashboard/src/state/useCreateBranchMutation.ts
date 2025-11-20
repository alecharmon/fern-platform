"use client";

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import createBranchIfNotExists, { type CreateBranchErrors } from "@/app/services/dal/github/createBranchIfNotExists";
import type { DocsUrl } from "@/utils/types";

interface CreateBranchParams {
    owner: string;
    repo: string;
    branch: string;
    baseBranch: string;
    orgName: Auth0OrgName;
    site: DocsUrl;
}

type CreateBranchResult =
    | {
          success: true;
          baseSha: string;
          alreadyExists: boolean;
      }
    | {
          success: false;
          error: CreateBranchErrors;
      };

export function useCreateBranchMutation(): UseMutationResult<CreateBranchResult, Error, CreateBranchParams> {
    return useMutation({
        mutationFn: async (params: CreateBranchParams) => {
            return await createBranchIfNotExists(params);
        },
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        onError: (error, variables) => {
            console.error("[useCreateBranchMutation] Failed to create branch:", error, variables.branch);
        }
    });
}
