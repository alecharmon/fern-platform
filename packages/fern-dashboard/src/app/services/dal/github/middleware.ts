import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";

import { deriveRepoIdentifier, normalizeRepoData } from "./request-utils";
import type { AuthenticatedHandler, GithubAuthContext } from "./types";
import { validateGithubRepoAccess } from "./validators";

/**
 * Higher-order function that wraps API route handlers with GitHub authentication
 *
 * This middleware:
 * 1. Validates user session
 * 2. Extracts repository data from request
 * 3. Validates GitHub access permissions
 * 4. Calls the wrapped handler with validated context
 *
 * @param handler - The actual route handler to wrap
 * @returns A new handler with GitHub authentication built-in
 *
 * @example
 * export const POST = withGithubAuth(async (req, { userId, repoData }) => {
 *   // Handler only runs if GitHub auth passes
 *   const result = await someGitOperation({ userId, ...repoData });
 *   return NextResponse.json(result);
 * });
 */
export function withGithubAuth<TAdditionalContext = {}>(
  handler: AuthenticatedHandler<TAdditionalContext>
) {
  return async (req: NextRequest, parsedBody?: any): Promise<NextResponse> => {
    try {
      // Step 1: Validate user session
      const sessionResult = await maybeGetCurrentSession(req);
      if (sessionResult.errorResponse != null) {
        return sessionResult.errorResponse;
      }

      const { userId } = sessionResult.data;

      // Step 2: Derive the repo identifier
      const data = parsedBody ?? (await req.json());
      const identifierResult = await deriveRepoIdentifier(data);

      if (!identifierResult.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }

      const { identifier } = identifierResult;

      // Step 3: Normalize the repo data
      const repoData = normalizeRepoData(identifier);

      // Step 4: Validate that the user has access to the repo
      const validation = await validateGithubRepoAccess(userId, identifier);

      if (!validation.repoExists) {
        return NextResponse.json(
          { error: "Repository not found or not accessible" },
          { status: 404 }
        );
      }
      if (!validation.hasWriteAccess) {
        return NextResponse.json(
          { error: "User does not have write permission to this repo" },
          { status: 403 }
        );
      }
      if (!validation.hasFernBotInstalled) {
        return NextResponse.json(
          { error: "Fern bot is not installed on this repo" },
          { status: 403 }
        );
      }

      // Step 5: Create validated context
      const context: GithubAuthContext = {
        userId,
        repoData,
      };

      // Step 6: Call the wrapped handler with validated context
      return await handler(
        req,
        context as GithubAuthContext & TAdditionalContext
      );
    } catch (error) {
      // Handle unexpected errors
      console.error("GitHub auth middleware error:", error);

      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 }
      );
    }
  };
}
