import "server-only";

import { get as getEdge } from "@vercel/edge-config";
import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

export interface ValidateGitlabRepoAccessRequest {
    url: string;
    token: string;
    owner: string;
    repo: string;
}

export interface ValidateGitlabRepoAccessResponse {
    ok: boolean;
    error?: {
        type: string;
        message: string;
    };
}

type GitLabConfigStructure = Record<string, { token: string }>;

export default async function handler({
    url,
    token,
    owner,
    repo
}: ValidateGitlabRepoAccessRequest): Promise<ValidateGitlabRepoAccessResponse> {
    const docsUrlMetadata = await getDocsUrlMetadata({ url, token });
    if (!docsUrlMetadata.ok) {
        if (docsUrlMetadata.error.error === "DomainNotRegisteredError") {
            return {
                ok: false,
                error: {
                    type: "DOMAIN_NOT_REGISTERED",
                    message: "This domain is not registered with Fern"
                }
            };
        }
        console.error("Failed to load docs URL metadata", JSON.stringify(docsUrlMetadata.error));
        return {
            ok: false,
            error: {
                type: "UNEXPECTED_ERROR",
                message: "Failed to load docs URL metadata"
            }
        };
    }

    try {
        const gitlabConfig = await getEdge<GitLabConfigStructure>("gitlab_config");

        if (!gitlabConfig || typeof gitlabConfig !== "object") {
            return {
                ok: false,
                error: {
                    type: "EDGE_CONFIG_ERROR",
                    message: "gitlab_config not found in Edge Config"
                }
            };
        }

        if (!gitlabConfig[owner]?.token) {
            return {
                ok: false,
                error: {
                    type: "GITLAB_TOKEN_NOT_CONFIGURED",
                    message: "Please contact Fern Support to set up a GitLab repository."
                }
            };
        }

        return {
            ok: true
        };
    } catch (error) {
        console.error(`Failed to check GitLab config for ${owner}/${repo}:`, error);
        return {
            ok: false,
            error: {
                type: "EDGE_CONFIG_ERROR",
                message: "Failed to verify GitLab configuration"
            }
        };
    }
}
