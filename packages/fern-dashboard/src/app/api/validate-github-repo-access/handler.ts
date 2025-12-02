import "server-only";

import { type GithubRepoValidationError, validateGithubRepoAccess } from "@/app/services/dal/github/validators";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";
import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

export interface ValidateGithubRepoAccessRequest {
    url: DocsUrl;
    token: string;
    owner: string;
    repo: string;
}

/**
 * Response type using discriminated union for type safety.
 * This matches the pattern of GithubRepoValidationResult.
 */
export type ValidateGithubRepoAccessResponse =
    | {
          ok: true;
          appInstalled: true;
      }
    | {
          ok: false;
          appInstalled: boolean;
          error: GithubRepoValidationError;
      };

export default async function handler({
    url,
    token,
    owner,
    repo
}: ValidateGithubRepoAccessRequest): Promise<ValidateGithubRepoAccessResponse> {
    const docsUrlMetadata = await getDocsUrlMetadata({ url, token });
    if (!docsUrlMetadata.ok) {
        if (docsUrlMetadata.error.error === "DomainNotRegisteredError") {
            return {
                ok: false,
                appInstalled: false,
                error: { type: "DOMAIN_NOT_REGISTERED" }
            };
        }
        console.error("Failed to load docs URL metadata", JSON.stringify(docsUrlMetadata.error));
        return {
            ok: false,
            appInstalled: false,
            error: {
                type: "UNEXPECTED_ERROR",
                message: "Failed to load docs URL metadata"
            }
        };
    }

    const orgName = docsUrlMetadata.body.org;
    const githubUrl = `https://github.com/${owner}/${repo}`;

    const result = await validateGithubRepoAccess(
        orgName,
        parseDocsUrlParam({ docsUrl: url }),
        { type: "url", githubUrl },
        true // skip cache for immediate feedback
    );

    if (result.ok) {
        return {
            ok: true,
            appInstalled: true
        };
    }

    const isFernBotNotInstalled = result.error.type === "FERN_BOT_NOT_INSTALLED";

    return {
        ok: false,
        appInstalled: !isFernBotNotInstalled,
        error: result.error
    };
}
