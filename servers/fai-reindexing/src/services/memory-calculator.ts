import { withoutStaging } from "@fern-api/docs-utils";
import { loadDocsWithUrl } from "@fern-docs/search-utils";
import type { Logger } from "winston";
import { env } from "../config/env";
import { withRetry } from "../utils/retry";
import { getMemoryOverride } from "./job-tracker";
import { flattenDomain } from "./turbopuffer/turbopuffer";

export interface MemoryRequirements {
    memoryMB: number;
    numPages: number;
    numEndpoints: number;
}

/**
 * Calculate memory requirements for a reindexing task based on documentation size.
 *
 * Uses a tiered approach:
 * - Base memory: 256 MB
 * - Pages tier:
 *   - 0 - 125 pages: +128 MB
 *   - 125 - 250 pages: +128 MB
 *   - 250-500 pages: +256 MB
 *   - 500-750 pages: +256 MB
 *   - 750-1000 pages: +256 MB
 *   - 1000+ pages: +512 MB
 * - Endpoints tier:
 *   - 0 - 125 endpoints: +128 MB
 *   - 125 - 250 endpoints: +128 MB
 *   - 250-500 endpoints: +256 MB
 *   - 500-750 endpoints: +256 MB
 *   - 750-1000 endpoints: +256 MB
 *   - 1000+ endpoints: +512 MB
 */
export async function calculateMemoryRequirements(
    domain: string,
    log: Logger,
    basepath?: string
): Promise<MemoryRequirements> {
    const start = Date.now();
    const loadDomain = basepath ? `${domain}${basepath}` : domain;
    log.info("Calculating memory requirements", { domain, basepath, loadDomain });

    const override = await getMemoryOverride(flattenDomain(domain), log);
    if (override !== null) {
        const duration = Date.now() - start;
        log.info("Using memory override for domain", {
            domain,
            memoryMB: override,
            durationMs: duration
        });
        return {
            memoryMB: override,
            numPages: 0,
            numEndpoints: 0
        };
    }

    const docsUrl = withoutStaging(loadDomain);
    const docs = await withRetry(
        async () =>
            await loadDocsWithUrl({
                environment: env.fdrOrigin,
                fernToken: env.fernToken,
                domain: docsUrl
            }),
        { maxAttempts: 3, initialDelayMs: 1000 }
    );

    let numPages = 0;
    let numEndpoints = 0;

    if (docs.pages) {
        numPages = Object.keys(docs.pages).length;
    }

    if (docs.apis) {
        for (const api of Object.values(docs.apis)) {
            if (api.endpoints) {
                numEndpoints += Object.keys(api.endpoints).length;
            }
        }
    }

    let memoryMB = 256;

    if (numPages >= 0) {
        memoryMB += 128;
    }
    if (numPages >= 125) {
        memoryMB += 128;
    }
    if (numPages >= 250) {
        memoryMB += 256;
    }
    if (numPages >= 500) {
        memoryMB += 256;
    }
    if (numPages >= 750) {
        memoryMB += 256;
    }
    if (numPages >= 1000) {
        memoryMB += 512;
    }

    if (numEndpoints >= 0) {
        memoryMB += 128;
    }
    if (numEndpoints >= 125) {
        memoryMB += 128;
    }
    if (numEndpoints >= 250) {
        memoryMB += 256;
    }
    if (numEndpoints >= 500) {
        memoryMB += 256;
    }
    if (numEndpoints >= 750) {
        memoryMB += 256;
    }
    if (numEndpoints >= 1000) {
        memoryMB += 512;
    }

    const boundedMemory = Math.max(512, Math.min(16384, memoryMB));
    const roundedMemory = Math.ceil(boundedMemory / 256) * 256;

    const duration = Date.now() - start;
    log.info("Memory calculation complete", {
        domain,
        numPages,
        numEndpoints,
        calculatedMemoryMB: memoryMB,
        allocatedMemoryMB: roundedMemory,
        durationMs: duration
    });

    return {
        memoryMB: roundedMemory,
        numPages,
        numEndpoints
    };
}

export function getCpuForMemory(memoryMB: number): number {
    const cpuUnits = Math.floor(memoryMB / 2);

    return Math.min(2048, Math.max(256, cpuUnits));
}
