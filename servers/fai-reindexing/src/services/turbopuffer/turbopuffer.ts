import { createOpenAI } from "@ai-sdk/openai";
import { withoutStaging } from "@fern-api/docs-utils";
import * as Sentry from "@sentry/node";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { env } from "../../config/env";
import { createDomainLogger } from "../../config/logger";
import { isAuthConfigured } from "../../utils/auth-config";
import { incrementalUpsertTurbopuffer } from "./turbopuffer-incremental-upsert-task";
import { upsertTurbopuffer } from "./turbopuffer-upsert-task";
import { getTurbopufferVectorizer } from "./turbopuffer-vectorizer";

export async function runTurbopufferUpsertTask(
    domain: string,
    basepath: string | undefined,
    deleteExisting: boolean
): Promise<number> {
    const normalizedBasepath = basepath ? (basepath.startsWith("/") ? basepath : `/${basepath}`) : undefined;
    const loadDomain = normalizedBasepath ? `${domain}${normalizedBasepath}` : domain;
    const logger = createDomainLogger(loadDomain);
    const fernDocsIndexName = getFernDocsIndexName();
    const namespace = getTurbopufferNamespace(domain, fernDocsIndexName);
    const openai = createOpenAI({ apiKey: env.openaiApiKey });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    logger.info("Turbopuffer upsert: domain resolution", {
        domain,
        basepath,
        loadDomain,
        namespace,
        route: basepath ? "basepath-aware (loading from domain+basepath)" : "default (loading from domain only)",
        deleteExisting
    });

    const authed = await isAuthConfigured(domain);

    const numInserted = await upsertTurbopuffer({
        apiKey: env.turbopufferApiKey,
        namespace,
        payload: {
            environment: env.fdrOrigin,
            fernToken: env.fernToken,
            domain: withoutStaging(loadDomain)
        },
        authed,
        vectorizer: getTurbopufferVectorizer(embeddingModel),
        deleteExisting,
        basepath: normalizedBasepath
    });

    logger.info("Upserted records to turbopuffer", { numInserted });

    return numInserted;
}

export async function runIncrementalTurbopufferUpsertTask(
    domain: string,
    basepath: string | undefined,
    forceFullReindex: boolean = false
): Promise<{
    numInserted: number;
    numUpdated: number;
    numDeleted: number;
    totalRecordsAffected: number;
    numChunksAdded: number;
    numChunksDeleted: number;
    changedParentIds: string[];
}> {
    const normalizedBasepath = basepath ? (basepath.startsWith("/") ? basepath : `/${basepath}`) : undefined;
    const loadDomain = normalizedBasepath ? `${domain}${normalizedBasepath}` : domain;
    const logger = createDomainLogger(loadDomain);
    const fernDocsIndexName = getFernDocsIndexName();
    const sourceNamespaceId = getTurbopufferNamespace(domain, fernDocsIndexName);
    const queryNamespace = getQueryNamespace(domain);
    const openai = createOpenAI({ apiKey: env.openaiApiKey });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    logger.info("Turbopuffer incremental upsert: domain resolution", {
        domain,
        basepath,
        normalizedBasepath,
        basepathReceived: basepath !== undefined,
        normalizedBasepathSet: normalizedBasepath !== undefined,
        loadDomain,
        sourceNamespaceId,
        queryNamespace,
        forceFullReindex,
        route: basepath ? "basepath-aware (loading from domain+basepath)" : "default (loading from domain only)"
    });

    const authed = await isAuthConfigured(domain);

    try {
        const result = await incrementalUpsertTurbopuffer({
            apiKey: env.turbopufferApiKey,
            queryNamespace,
            sourceNamespaceId,
            payload: {
                environment: env.fdrOrigin,
                fernToken: env.fernToken,
                domain: withoutStaging(loadDomain)
            },
            authed,
            vectorizer: getTurbopufferVectorizer(embeddingModel),
            basepath: normalizedBasepath,
            forceFullReindex
        });

        const { changedParentIds, ...resultStats } = result;
        logger.info("Incremental upsert completed", { ...resultStats });

        return result;
    } catch (error) {
        Sentry.captureException(error, {
            tags: { component: "turbopuffer", operation: "incremental_upsert", domain },
            extra: { basepath, normalizedBasepath, loadDomain, queryNamespace, sourceNamespaceId, forceFullReindex }
        });
        logger.error("Incremental turbopuffer upsert failed", {
            error: error instanceof Error ? error.message : String(error),
            domain,
            basepath,
            normalizedBasepath,
            queryNamespace,
            sourceNamespaceId
        });
        throw error;
    }
}

export function getFernDocsIndexName(): string {
    return `fern_docs`;
}

// Sanitizes domain for use in path-param APIs (job tracker, content hash, etc.).
// For basepath multi-repo domains (e.g. "docs.nvidia.com/nemo"), replaces "/" with "_"
// to avoid breaking Fern SDK path-param encoding (which would double-encode %2F).
export function flattenDomain(domain: string): string {
    return domain.replace(/\//g, "_");
}

// Extracts the basepath from a domain string (e.g. "docs.nvidia.com/nemo" → "/nemo").
// Returns undefined if no basepath is present.
export function extractBasepath(domain: string): string | undefined {
    const slashIndex = domain.indexOf("/");
    if (slashIndex === -1) {
        return undefined;
    }
    return domain.slice(slashIndex);
}

export function getTurbopufferNamespace(domain: string, indexName: string): string {
    return `${flattenDomain(withoutStaging(domain))}_${indexName}`;
}

export function getQueryNamespace(domain: string): string {
    return getTurbopufferNamespace(domain, "query");
}

export async function deleteTurbopufferNamespace(domain: string, basepath: string | undefined): Promise<void> {
    const logger = createDomainLogger(domain);
    const queryNs = getQueryNamespace(domain);

    const tpuf = new Turbopuffer({ apiKey: env.turbopufferApiKey, region: "gcp-us-east4" });
    const ns = tpuf.namespace(queryNs);

    const normalizedBasepath = basepath ? (basepath.startsWith("/") ? basepath : `/${basepath}`) : undefined;

    try {
        if (normalizedBasepath) {
            logger.info("Deleting fern_docs basepath records from query namespace", {
                queryNamespace: queryNs,
                basepath: normalizedBasepath
            });
            await ns.write({
                delete_by_filter: [
                    "And",
                    [
                        ["source", "Eq", "fern_docs"],
                        ["basepath", "Eq", normalizedBasepath]
                    ]
                ]
            });
        } else {
            logger.info("Deleting all fern_docs records from query namespace", { queryNamespace: queryNs });
            await ns.write({ delete_by_filter: ["source", "Eq", "fern_docs"] });
        }

        logger.info("Successfully deleted fern_docs records from query namespace", {
            queryNamespace: queryNs,
            basepath: normalizedBasepath
        });
    } catch (error) {
        Sentry.captureException(error, {
            tags: { component: "turbopuffer", operation: "delete_namespace", domain },
            extra: { queryNamespace: queryNs, basepath: normalizedBasepath }
        });
        logger.error("Failed to delete fern_docs records from query namespace", {
            error: error instanceof Error ? error.message : String(error),
            queryNamespace: queryNs,
            basepath: normalizedBasepath
        });
        throw error;
    }
}
