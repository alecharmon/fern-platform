"use client";

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import postGitCommit, { type PostGitCommitErrors } from "@/app/services/dal/github/postGitCommit";
import type { GithubCommitableFile } from "@/app/services/github/types";

interface CommitToGitHubParams {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    orgName: Auth0OrgName;
    files: GithubCommitableFile[];
    site: string;
}

type CommitToGitHubResult =
    | {
          success: true;
          commitSha?: string;
      }
    | {
          success: false;
          error: PostGitCommitErrors;
      };

export function useCommitToGitHubMutation(): UseMutationResult<CommitToGitHubResult, Error, CommitToGitHubParams> {
    return useMutation({
        mutationFn: async (params: CommitToGitHubParams) => {
            return postGitCommit(params);
        },
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
    });
}
