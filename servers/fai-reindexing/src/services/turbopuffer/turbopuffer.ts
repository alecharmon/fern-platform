import { createOpenAI } from "@ai-sdk/openai";
import { withoutStaging } from "@fern-api/docs-utils";
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
    basepath: string | undefined
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
    const namespace = getTurbopufferNamespace(domain, fernDocsIndexName);
    const openai = createOpenAI({ apiKey: env.openaiApiKey });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    logger.info("Turbopuffer incremental upsert: domain resolution", {
        domain,
        basepath,
        loadDomain,
        namespace,
        route: basepath ? "basepath-aware (loading from domain+basepath)" : "default (loading from domain only)"
    });

    const authed = await isAuthConfigured(domain);

    const result = await incrementalUpsertTurbopuffer({
        apiKey: env.turbopufferApiKey,
        namespace,
        payload: {
            environment: env.fdrOrigin,
            fernToken: env.fernToken,
            domain: withoutStaging(loadDomain)
        },
        authed,
        vectorizer: getTurbopufferVectorizer(embeddingModel),
        basepath: normalizedBasepath
    });

    const { changedParentIds, ...resultStats } = result;
    logger.info("Incremental upsert completed", { ...resultStats });

    return result;
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

export async function deleteTurbopufferNamespace(domain: string, basepath: string | undefined): Promise<void> {
    const logger = createDomainLogger(domain);
    const namespace = getTurbopufferNamespace(domain, getFernDocsIndexName());

    const tpuf = new Turbopuffer({ apiKey: env.turbopufferApiKey, region: "gcp-us-east4" });
    const ns = tpuf.namespace(namespace);

    const normalizedBasepath = basepath ? (basepath.startsWith("/") ? basepath : `/${basepath}`) : undefined;

    if (normalizedBasepath) {
        logger.info("Deleting basepath records from shared Turbopuffer namespace", {
            namespace,
            basepath: normalizedBasepath
        });
        await ns.write({ delete_by_filter: ["basepath", "Eq", normalizedBasepath] });
    } else {
        logger.info("Deleting all records from Turbopuffer namespace", { namespace });
        await ns.deleteAll();
    }

    logger.info("Successfully deleted Turbopuffer records", { namespace, basepath: normalizedBasepath });
}
