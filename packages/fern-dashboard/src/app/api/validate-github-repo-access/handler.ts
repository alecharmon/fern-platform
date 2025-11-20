import "server-only";

import { validateGithubRepoAccess } from "@/app/services/dal/github/validators";
import { getValidationErrorMessage } from "@/utils/errors";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

export interface ValidateGithubRepoAccessRequest {
    url: string;
    token: string;
    owner: string;
    repo: string;
}

export interface ValidateGithubRepoAccessResponse {
    ok: boolean;
    appInstalled: boolean;
    error?: {
        type: string;
        message: string;
    };
}

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
                error: {
                    type: "DOMAIN_NOT_REGISTERED",
                    message: "This domain is not registered with Fern"
                }
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

    const errorType = result.error.type;
    const isFernBotNotInstalled = errorType === "FERN_BOT_NOT_INSTALLED";

    return {
        ok: false,
        appInstalled: !isFernBotNotInstalled,
        error: {
            type: errorType,
            message: getValidationErrorMessage(result.error)
        }
    };
}
