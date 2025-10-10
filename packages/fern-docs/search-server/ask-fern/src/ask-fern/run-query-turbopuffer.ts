import type { EmbeddingModel } from "ai";
import { embed } from "ai";

import { turbopufferApiKey } from "@fern-api/docs-server/env-variables";
import type { FacetFilter } from "@fern-docs/search-keyword";

import { isAuthError, queryTurbopuffer, type TurbopufferQueryResult } from "../turbopuffer";

export async function runQueryTurbopuffer(
    query: string | null | undefined,
    opts: {
        embeddingModel: EmbeddingModel<string>;
        namespace: string;
        topK?: number;
        filters?: FacetFilter[];
        documentIdsToIgnore?: string[];
        urlsToIgnore?: string[];
        documentUrls?: string[];
        explodedRoles: string[];
        userIsAuthed: boolean;
    }
): Promise<TurbopufferQueryResult> {
    if (query == null || query.trimStart().length === 0) {
        return [];
    }

    const results = await queryTurbopuffer(query, {
        namespace: opts.namespace,
        apiKey: turbopufferApiKey(),
        topK: opts.topK ?? 5,
        vectorizer: async (text) => {
            const embedding = await embed({
                model: opts.embeddingModel,
                value: text
            });
            return embedding.embedding;
        },
        filters: opts.filters,
        documentIdsToIgnore: opts.documentIdsToIgnore,
        urlsToIgnore: opts.urlsToIgnore,
        documentUrls: opts.documentUrls,
        explodedRoles: opts.explodedRoles,
        userIsAuthed: opts.userIsAuthed
    });

    if (isAuthError(results)) {
        return results;
    }

    if (results.length === 0 && !opts.userIsAuthed) {
        const publicContentCheck = await queryTurbopuffer(query, {
            namespace: opts.namespace,
            apiKey: turbopufferApiKey(),
            topK: 1,
            vectorizer: async (text) => {
                const embedding = await embed({
                    model: opts.embeddingModel,
                    value: text
                });
                return embedding.embedding;
            },
            filters: opts.filters,
            explodedRoles: opts.explodedRoles,
            userIsAuthed: false // check for any public content where authed=false
        });

        if (!isAuthError(publicContentCheck) && publicContentCheck.length === 0) {
            return {
                error: "unauthorized",
                message:
                    "Sorry, I cannot help you with that question because it requires authentication. Please log in.",
                requiresAuth: true
            };
        }
    }

    return results;
}
