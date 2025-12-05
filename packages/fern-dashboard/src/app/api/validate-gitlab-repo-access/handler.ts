import "server-only";

import { get as getEdge } from "@vercel/edge-config";
import type { GitRepoValidationError } from "@/app/services/dal/github/validators";
import type { DocsUrl } from "@/utils/types";
import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

export interface ValidateGitlabRepoAccessRequest {
    url: DocsUrl;
    token: string;
    owner: string;
    /** For GitLab, this contains the full path after owner (e.g., "team/subteam/my-repo") */
    repo: string;
}

export type ValidateGitlabRepoAccessResponse =
    | {
          ok: true;
          appInstalled: true; // NOTE: This is always true for GitLab
      }
    | {
          ok: false;
          appInstalled: true; // NOTE: This is always true for GitLab
          error: GitRepoValidationError;
      };

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
                appInstalled: true,
                error: { type: "DOMAIN_NOT_REGISTERED" }
            };
        }
        console.error("Failed to load docs URL metadata", JSON.stringify(docsUrlMetadata.error));
        return {
            ok: false,
            appInstalled: true,
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
                appInstalled: true,
                error: {
                    type: "EDGE_CONFIG_ERROR",
                    message: "gitlab_config not found in Edge Config"
                }
            };
        }

        if (!gitlabConfig[owner]?.token) {
            return {
                ok: false,
                appInstalled: true,
                error: {
                    type: "GITLAB_TOKEN_NOT_CONFIGURED"
                }
            };
        }

        return {
            ok: true,
            appInstalled: true
        };
    } catch (error) {
        console.error(`Failed to check GitLab config for ${owner}/${repo}:`, error);
        return {
            ok: false,
            appInstalled: true,
            error: {
                type: "EDGE_CONFIG_ERROR",
                message: "Failed to verify GitLab configuration"
            }
        };
    }
}
