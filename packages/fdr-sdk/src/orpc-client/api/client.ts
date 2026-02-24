import { createORPCClient } from "@orpc/client";
import { oc } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import * as z from "zod";

import type { LatestApiDefinition } from "./contract-latest.js";
import { LatestApiDefinitionSchema } from "./contract-latest.js";
import type { ReadApiDefinition, ReadEndpointDefinition } from "./contract-read.js";
import { ReadApiDefinitionSchema, ReadEndpointDefinitionSchema } from "./contract-read.js";
import type {
    CheckSdkDynamicIrExistsResponse,
    DynamicIR,
    GetSdkDynamicIrUploadUrlsResponse,
    RegisterApiDefinition,
    RegisterApiDefinitionResponse,
    Source
} from "./contract-register.js";
import {
    CheckSdkDynamicIrExistsResponseSchema,
    DynamicIRSchema,
    GetSdkDynamicIrUploadUrlsResponseSchema,
    RegisterApiDefinitionResponseSchema,
    RegisterApiDefinitionSchema,
    SourceIdSchema,
    SourceSchema
} from "./contract-register.js";
import type { HttpMethod } from "./shared.js";
import { HttpMethodSchema } from "./shared.js";

// ── Contract definitions ─────────────────────────────────────────────────
// Contract objects are NOT exported to avoid TS7056 declaration emit errors
// caused by the deeply recursive zod schema types. They are only used
// internally by the createApiClient factory function.

const apiLatestContract = {
    getApiLatest: oc
        .route({ method: "GET", path: "/load/{apiDefinitionId}" })
        .input(z.object({ apiDefinitionId: z.string() }))
        .output(LatestApiDefinitionSchema)
};

const apiReadContract = {
    getApi: oc
        .route({ method: "GET", path: "/load/{apiDefinitionId}" })
        .input(z.object({ apiDefinitionId: z.string() }))
        .output(ReadApiDefinitionSchema),

    getApiDefinitionFull: oc
        .route({ method: "GET", path: "/load-full/{apiDefinitionId}" })
        .input(z.object({ apiDefinitionId: z.string() }))
        .output(ReadApiDefinitionSchema),

    getEndpointById: oc
        .route({ method: "GET", path: "/load/{apiDefinitionId}/endpoint/{endpointId}" })
        .input(z.object({ apiDefinitionId: z.string(), endpointId: z.string() }))
        .output(ReadEndpointDefinitionSchema),

    getEndpointByLocator: oc
        .route({ method: "GET", path: "/load/{apiDefinitionId}/endpoint" })
        .input(
            z.object({
                apiDefinitionId: z.string(),
                method: HttpMethodSchema.nullish(),
                path: z.string().nullish(),
                identifierOverride: z.string().nullish()
            })
        )
        .output(ReadEndpointDefinitionSchema)
};

const apiRegisterContract = {
    registerApiDefinition: oc
        .route({ method: "POST", path: "/register" })
        .input(
            z.object({
                orgId: z.string(),
                apiId: z.string(),
                definition: RegisterApiDefinitionSchema,
                sources: z.record(SourceIdSchema, SourceSchema).nullish(),
                dynamicIRs: z.record(z.string(), DynamicIRSchema).nullish()
            })
        )
        .output(RegisterApiDefinitionResponseSchema),

    getSdkDynamicIrUploadUrls: oc
        .route({ method: "POST", path: "/sdk-dynamic-ir-upload-urls" })
        .input(
            z.object({
                orgId: z.string(),
                apiId: z.string(),
                irVersions: z.array(z.string())
            })
        )
        .output(GetSdkDynamicIrUploadUrlsResponseSchema),

    checkSdkDynamicIrExists: oc
        .route({ method: "POST", path: "/check-sdk-dynamic-ir" })
        .input(
            z.object({
                orgId: z.string(),
                apiId: z.string(),
                irVersions: z.array(z.string())
            })
        )
        .output(CheckSdkDynamicIrExistsResponseSchema)
};

// ── Client types ─────────────────────────────────────────────────────────
// Explicitly defined to avoid TS7056 (inferred type too long) that occurs
// when using typeof on contract objects with deeply recursive zod schemas.

export interface ApiLatestClient {
    getApiLatest(input: { apiDefinitionId: string }): Promise<LatestApiDefinition>;
}

export interface ApiReadClient {
    getApi(input: { apiDefinitionId: string }): Promise<ReadApiDefinition>;
    getApiDefinitionFull(input: { apiDefinitionId: string }): Promise<ReadApiDefinition>;
    getEndpointById(input: { apiDefinitionId: string; endpointId: string }): Promise<ReadEndpointDefinition>;
    getEndpointByLocator(input: {
        apiDefinitionId: string;
        method?: HttpMethod;
        path?: string;
        identifierOverride?: string;
    }): Promise<ReadEndpointDefinition>;
}

export interface ApiRegisterClient {
    registerApiDefinition(input: {
        orgId: string;
        apiId: string;
        definition: RegisterApiDefinition;
        sources?: Record<string, Source> | null;
        dynamicIRs?: Record<string, DynamicIR> | null;
    }): Promise<RegisterApiDefinitionResponse>;
    getSdkDynamicIrUploadUrls(input: {
        orgId: string;
        apiId: string;
        irVersions: string[];
    }): Promise<GetSdkDynamicIrUploadUrlsResponse>;
    checkSdkDynamicIrExists(input: {
        orgId: string;
        apiId: string;
        irVersions: string[];
    }): Promise<CheckSdkDynamicIrExistsResponse>;
}

export interface ApiClient {
    latest: ApiLatestClient;
    read: ApiReadClient;
    register: ApiRegisterClient;
}

export interface CreateApiClientOptions {
    baseUrl: string;
    token: string;
}

export function createApiClient(options: CreateApiClientOptions): ApiClient {
    const latestLink = new OpenAPILink(apiLatestContract, {
        url: `${options.baseUrl}/registry/api/latest`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });

    const readLink = new OpenAPILink(apiReadContract, {
        url: `${options.baseUrl}/registry/api`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });

    const registerLink = new OpenAPILink(apiRegisterContract, {
        url: `${options.baseUrl}/registry/api`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });

    return {
        latest: createORPCClient(latestLink) as unknown as ApiLatestClient,
        read: createORPCClient(readLink) as unknown as ApiReadClient,
        register: createORPCClient(registerLink) as unknown as ApiRegisterClient
    };
}
