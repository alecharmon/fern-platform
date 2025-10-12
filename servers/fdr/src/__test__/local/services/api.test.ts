import { APIV1Write, FdrAPI } from "@fern-api/fdr-sdk";
import { v4 } from "uuid";
import { expect, inject, it } from "vitest";

import type { DynamicIr } from "../../../api/generated/api/resources/api/resources/v1/resources/register";
import { createApiDefinition, createApiDefinitionLatest, getAPIResponse, getClient } from "../util";

export const EMPTY_REGISTER_API_DEFINITION: APIV1Write.ApiDefinition = {
    rootPackage: {
        endpoints: [],
        webhooks: [],
        websockets: [],
        types: [],
        subpackages: [],
        pointsTo: undefined
    },
    subpackages: {},
    types: {},
    auth: undefined,
    globalHeaders: undefined,
    snippetsConfiguration: undefined,
    navigation: undefined
};

const MOCK_REGISTER_API_DEFINITION: APIV1Write.ApiDefinition = createApiDefinition({
    endpointId: APIV1Write.EndpointId("dummy"),
    endpointMethod: "POST",
    endpointPath: {
        parts: [{ type: "literal", value: "dummy" }],
        pathParameters: []
    }
});

it("register api", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });
    // register empty definition
    const emptyDefinitionRegisterResponse = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api"),
            definition: EMPTY_REGISTER_API_DEFINITION
        })
    );

    console.log(`Registered empty definition. Received ${emptyDefinitionRegisterResponse.apiDefinitionId}`);
    // load empty definition
    const registeredEmptyDefinition = getAPIResponse(
        await fdr.api.v1.read.getApi(emptyDefinitionRegisterResponse.apiDefinitionId)
    );

    // assert definitions are equal
    expect(JSON.stringify(registeredEmptyDefinition.types)).toEqual(
        JSON.stringify(EMPTY_REGISTER_API_DEFINITION.types)
    );
    expect(JSON.stringify(registeredEmptyDefinition.subpackages)).toEqual(
        JSON.stringify(EMPTY_REGISTER_API_DEFINITION.subpackages)
    );
    expect(registeredEmptyDefinition.rootPackage).toEqual(EMPTY_REGISTER_API_DEFINITION.rootPackage);

    // register updated definition
    const updatedDefinitionRegisterResponse = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api"),
            definition: MOCK_REGISTER_API_DEFINITION
        })
    );
    // load updated definition
    const updatedDefinition = getAPIResponse(
        await fdr.api.v1.read.getApi(updatedDefinitionRegisterResponse.apiDefinitionId)
    );
    // assert definitions equal
    expect(JSON.stringify(updatedDefinition.types)).toEqual(JSON.stringify(MOCK_REGISTER_API_DEFINITION.types));
    expect(JSON.stringify(updatedDefinition.subpackages)).toEqual(
        JSON.stringify(MOCK_REGISTER_API_DEFINITION.subpackages)
    );
});

function createEmptyApiLatestDefinition(): FdrAPI.api.latest.ApiDefinition {
    return {
        endpoints: {},
        types: {},
        subpackages: {},
        websockets: {},
        webhooks: {},
        id: FdrAPI.ApiDefinitionId(v4()),
        auths: {},
        globalHeaders: undefined,
        snippetsConfiguration: undefined
    };
}

const MOCK_REGISTER_API_LATEST_DEFINITION: FdrAPI.api.latest.ApiDefinition = createApiDefinitionLatest({
    endpointId: FdrAPI.EndpointId("dummy"),
    endpointMethod: "POST",
    endpointPath: [{ type: "literal" as const, value: "dummy" }]
});

it("register api latest", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });
    const emptyDefinition = createEmptyApiLatestDefinition();
    const emptyDefinitionRegisterResponse = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api"),
            definitionV2: emptyDefinition
        })
    );

    console.log(`Registered empty definition. Received ${emptyDefinitionRegisterResponse.apiDefinitionId}`);
    // load empty definition
    const registeredEmptyDefinition = getAPIResponse(
        await fdr.api.latest.getApiLatest(emptyDefinitionRegisterResponse.apiDefinitionId)
    );

    // assert definitions are equal
    expect(JSON.stringify(registeredEmptyDefinition.types)).toEqual(JSON.stringify(emptyDefinition.types));
    expect(JSON.stringify(registeredEmptyDefinition.subpackages)).toEqual(JSON.stringify(emptyDefinition.subpackages));
    expect(registeredEmptyDefinition).toEqual(emptyDefinition);

    // register updated definition
    const updatedDefinitionRegisterResponse = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api"),
            definitionV2: MOCK_REGISTER_API_LATEST_DEFINITION
        })
    );
    // load updated definition
    const updatedDefinition = getAPIResponse(
        await fdr.api.latest.getApiLatest(updatedDefinitionRegisterResponse.apiDefinitionId)
    );
    // assert definitions equal
    expect(JSON.stringify(updatedDefinition.types)).toEqual(JSON.stringify(MOCK_REGISTER_API_LATEST_DEFINITION.types));
    expect(JSON.stringify(updatedDefinition.subpackages)).toEqual(
        JSON.stringify(MOCK_REGISTER_API_LATEST_DEFINITION.subpackages)
    );
});

// Test sourceUploads functionality
it("register api with sources", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    const sources: Record<APIV1Write.SourceId, APIV1Write.Source> = {
        [APIV1Write.SourceId("openapi-spec")]: {
            type: "openapi"
        },
        [APIV1Write.SourceId("asyncapi-spec")]: {
            type: "asyncapi"
        }
    };

    const response = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api-with-sources"),
            definition: EMPTY_REGISTER_API_DEFINITION,
            sources
        })
    );

    // Verify response contains apiDefinitionId
    expect(response.apiDefinitionId).toBeDefined();

    // Verify sources are returned with upload and download URLs
    expect(response.sources).toBeDefined();
    expect(response.sources).toHaveProperty("openapi-spec");
    expect(response.sources).toHaveProperty("asyncapi-spec");

    // Verify each source has upload and download URLs
    Object.values(response.sources!).forEach((sourceUpload) => {
        expect(sourceUpload.uploadUrl).toBeDefined();
        expect(sourceUpload.downloadUrl).toBeDefined();
        expect(typeof sourceUpload.uploadUrl).toBe("string");
        expect(typeof sourceUpload.downloadUrl).toBe("string");
        expect(sourceUpload.uploadUrl).toContain("http");
        expect(sourceUpload.downloadUrl).toContain("http");
    });
});

it("register api with dynamicIr", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    const dynamicIRs: Record<string, DynamicIr> = {
        typescript: {
            dynamicIR: {}
        },
        python: {
            dynamicIR: {}
        }
    };

    const response = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api-with-dynamic-ir"),
            definition: EMPTY_REGISTER_API_DEFINITION,
            dynamicIRs
        })
    );

    // Verify response contains apiDefinitionId
    expect(response.apiDefinitionId).toBeDefined();

    // Verify sources are returned for dynamicIr languages
    expect(response.sources).toBeUndefined();
    expect(response.dynamicIRs).toHaveProperty("typescript");
    expect(response.dynamicIRs).toHaveProperty("python");

    // Verify each dynamicIr source has upload URLs
    Object.values(response.dynamicIRs!).forEach((dynamicIRUpload) => {
        expect(dynamicIRUpload.uploadUrl).toBeDefined();
        expect(typeof dynamicIRUpload.uploadUrl).toBe("string");
        expect(dynamicIRUpload.uploadUrl).toContain(response.apiDefinitionId);
        expect(dynamicIRUpload.uploadUrl).toContain("http");
    });
});

it("register api with both sources and dynamicIr", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    const sources: Record<APIV1Write.SourceId, APIV1Write.Source> = {
        [APIV1Write.SourceId("openapi-spec")]: {
            type: "openapi"
        }
    };

    const dynamicIRs: Record<string, DynamicIr> = {
        typescript: {
            dynamicIR: {}
        }
    };

    const response = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api-with-both"),
            definition: EMPTY_REGISTER_API_DEFINITION,
            sources,
            dynamicIRs
        })
    );

    // Verify response contains apiDefinitionId
    expect(response.apiDefinitionId).toBeDefined();

    // Verify sources are returned for both sources and dynamicIr
    expect(response.sources).toBeDefined();
    expect(response.sources).toHaveProperty("openapi-spec");
    expect(response.dynamicIRs).toBeDefined();
    expect(response.dynamicIRs).toHaveProperty("typescript");

    // Verify total number of sources matches expected count
    expect(Object.keys(response.sources!).length).toBe(1);
    expect(Object.keys(response.dynamicIRs!).length).toBe(1);

    // Verify each source has upload and download URLs
    Object.values(response.sources!).forEach((sourceUpload) => {
        expect(sourceUpload.uploadUrl).toBeDefined();
        expect(sourceUpload.downloadUrl).toBeDefined();
        expect(typeof sourceUpload.uploadUrl).toBe("string");
        expect(typeof sourceUpload.downloadUrl).toBe("string");
        expect(sourceUpload.uploadUrl).toContain("http");
        expect(sourceUpload.downloadUrl).toContain("http");
    });

    // Verify each dynamicIr source has upload URLs
    Object.values(response.dynamicIRs!).forEach((dynamicIRUpload) => {
        expect(dynamicIRUpload.uploadUrl).toBeDefined();
        expect(typeof dynamicIRUpload.uploadUrl).toBe("string");
        expect(dynamicIRUpload.uploadUrl).toContain(response.apiDefinitionId);
        expect(dynamicIRUpload.uploadUrl).toContain("http");
    });
});

it("register api without sources or dynamicIr", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    const response = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api-without-sources"),
            definition: EMPTY_REGISTER_API_DEFINITION
        })
    );

    // Verify response contains apiDefinitionId
    expect(response.apiDefinitionId).toBeDefined();

    // Verify sources are undefined when not provided
    expect(response.sources).toBeUndefined();
});

it("register api latest with sources", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    const sources: Record<APIV1Write.SourceId, APIV1Write.Source> = {
        [APIV1Write.SourceId("proto-spec")]: {
            type: "proto"
        }
    };

    const response = getAPIResponse(
        await fdr.api.v1.register.registerApiDefinition({
            orgId: FdrAPI.OrgId("fern"),
            apiId: FdrAPI.ApiId("api-latest-with-sources"),
            definitionV2: createEmptyApiLatestDefinition(),
            sources
        })
    );

    // Verify response contains apiDefinitionId
    expect(response.apiDefinitionId).toBeDefined();

    // Verify sources are returned
    expect(response.sources).toBeDefined();
    expect(response.dynamicIRs).toBeUndefined();
    expect(response.sources).toHaveProperty("proto-spec");

    // Verify source has upload and download URLs
    const sourceUpload = response.sources![APIV1Write.SourceId("proto-spec")];
    expect(sourceUpload.uploadUrl).toBeDefined();
    expect(sourceUpload.downloadUrl).toBeDefined();
    expect(typeof sourceUpload.uploadUrl).toBe("string");
    expect(typeof sourceUpload.downloadUrl).toBe("string");
    expect(sourceUpload.uploadUrl).toContain("http");
    expect(sourceUpload.downloadUrl).toContain("http");
});
