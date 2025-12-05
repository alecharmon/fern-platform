import type { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import type { Auth0UserID } from "../../auth0/types";

export type RepoIdentifier =
    | {
          type: "owner-repo";
          owner: string;
          repo: string;
      }
    | {
          type: "url";
          gitUrl: string;
      };

export interface AuthenticatedAccessOptions {
    userId: Auth0UserID;
}

export interface GithubAccessValidationOptions {
    owner?: string;
    repo?: string;
    githubUrl?: string;
}

export const GithubIdentificationScheme = z.union([
    z.object({
        site: z.string(),
        owner: z.string(),
        repo: z.string()
    }),
    z.object({
        site: z.string(),
        githubUrl: z.string()
    })
]);

export type GithubIdentificationSchemeType = z.infer<typeof GithubIdentificationScheme>;

// Wrapper-specific types
export interface RepoData {
    owner: string;
    repo: string;
    githubUrl: string;
}

export interface GithubAuthContext {
    userId: Auth0UserID;
    repoData: RepoData;
}

export type AuthenticatedHandler<TAdditionalContext, TValidatedBody = undefined> = (
    req: NextRequest,
    context: GithubAuthContext & TAdditionalContext,
    ...args: TValidatedBody extends undefined ? [] : [TValidatedBody]
) => Promise<NextResponse>;

export type ValidationResult<T = undefined> =
    | { success: true; data: T }
    | { success: false; errorResponse: NextResponse };

export interface ExtractedRepoData {
    owner: string;
    repo: string;
    githubUrl?: string;
}
