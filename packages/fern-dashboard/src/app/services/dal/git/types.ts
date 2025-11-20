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

export interface GitAccessValidationOptions {
    owner?: string;
    repo?: string;
    gitUrl?: string;
}

export const GitIdentificationScheme = z.union([
    z.object({
        site: z.string(),
        owner: z.string(),
        repo: z.string()
    }),
    z.object({
        site: z.string(),
        gitUrl: z.string()
    })
]);

export type GitIdentificationSchemeType = z.infer<typeof GitIdentificationScheme>;

// Wrapper-specific types
export interface RepoData {
    owner: string;
    repo: string;
    gitUrl: string;
}

export interface GitAuthContext {
    userId: Auth0UserID;
    repoData: RepoData;
}

export type AuthenticatedHandler<TAdditionalContext, TValidatedBody = undefined> = (
    req: NextRequest,
    context: GitAuthContext & TAdditionalContext,
    ...args: TValidatedBody extends undefined ? [] : [TValidatedBody]
) => Promise<NextResponse>;

export type ValidationResult<T = undefined> =
    | { success: true; data: T }
    | { success: false; errorResponse: NextResponse };

export interface ExtractedRepoData {
    owner: string;
    repo: string;
    gitUrl?: string;
}
