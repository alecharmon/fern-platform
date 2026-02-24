import assertNever from "@fern-api/ui-core-utils/assertNever";

import type { APIV1Db, APIV1Read } from "../../client";
import { AuthSchemeId } from "../../orpc-client/api/shared.js";

export function convertDbAPIDefinitionsToRead(dbApiDefinitions: Record<string, APIV1Db.DbApiDefinition>) {
    return Object.fromEntries(
        Object.entries(dbApiDefinitions).map(([id, dbDefinition]) => {
            const parsedApiDefinition = convertDbAPIDefinitionToRead(dbDefinition);
            return [id, parsedApiDefinition];
        })
    );
}

export function convertDbAPIDefinitionToRead(dbShape: APIV1Db.DbApiDefinition): APIV1Read.ApiDefinition {
    return {
        id: dbShape.id,
        apiName: dbShape.apiName,
        rootPackage: {
            endpoints: dbShape.rootPackage.endpoints.map((endpoint) => transformEndpoint({ dbShape: endpoint })),
            subpackages: dbShape.rootPackage.subpackages,
            types: dbShape.rootPackage.types,
            webhooks: (dbShape.rootPackage.webhooks ?? []) as APIV1Read.WebhookDefinition[],
            websockets: (dbShape.rootPackage.websockets ?? []) as APIV1Read.WebSocketChannel[],
            graphqlOperations: dbShape.rootPackage.graphqlOperations ?? [],
            pointsTo: dbShape.rootPackage.pointsTo
        },
        types: dbShape.types,
        subpackages: Object.fromEntries(
            Object.entries(dbShape.subpackages).map(([id, subpackage]) => {
                return [id, transformSubpackage({ dbShape: subpackage })];
            })
        ),
        snippetsConfiguration: dbShape.snippetsConfiguration,
        auth: dbShape.auth,
        authSchemes: dbShape.authSchemes,
        hasMultipleBaseUrls: dbShape.hasMultipleBaseUrls,
        navigation: dbShape.navigation,
        globalHeaders: dbShape.globalHeaders
    };
}

function transformSubpackage({
    dbShape
}: {
    dbShape: APIV1Db.DbApiDefinitionSubpackage;
}): APIV1Read.ApiDefinitionSubpackage {
    return {
        subpackageId: dbShape.subpackageId,
        parent: dbShape.parent,
        name: dbShape.name,
        endpoints: dbShape.endpoints.map((endpoint) => transformEndpoint({ dbShape: endpoint })),
        types: dbShape.types,
        subpackages: dbShape.subpackages,
        pointsTo: dbShape.pointsTo,
        urlSlug: dbShape.urlSlug,
        description: dbShape.description,
        // htmlDescription: dbShape.htmlDescription,
        webhooks: (dbShape.webhooks ?? []) as APIV1Read.WebhookDefinition[],
        websockets: (dbShape.websockets ?? []) as APIV1Read.WebSocketChannel[],
        graphqlOperations: dbShape.graphqlOperations ?? [],
        displayName: dbShape.displayName
        // descriptionContainsMarkdown: dbShape.descriptionContainsMarkdown,
    };
}

export function transformEndpoint({
    dbShape
}: {
    dbShape: APIV1Db.DbEndpointDefinition;
}): APIV1Read.EndpointDefinition {
    return {
        environments: dbShape.environments ?? [],
        availability: dbShape.availability,
        defaultEnvironment: dbShape.defaultEnvironment,
        urlSlug: dbShape.urlSlug,
        migratedFromUrlSlugs: dbShape.migratedFromUrlSlugs,
        method: dbShape.method,
        id: dbShape.id,
        originalEndpointId: dbShape.originalEndpointId,
        name: dbShape.name,
        path: dbShape.path,
        queryParameters: dbShape.queryParameters,
        headers: dbShape.headers,
        responseHeaders: dbShape.responseHeaders,
        request: dbShape.request != null ? transformHttpRequest({ dbShape: dbShape.request }) : undefined,
        requestsV2: (() => {
            if (dbShape.requestsV2 == null) {
                return undefined;
            }
            if (dbShape.requestsV2.requests == null || dbShape.requestsV2.requests.length === 0) {
                return dbShape.request != null
                    ? {
                          requests: [transformHttpRequest({ dbShape: dbShape.request })]
                      }
                    : undefined;
            }
            return {
                requests: dbShape.requestsV2.requests.map((request) => transformHttpRequest({ dbShape: request }))
            };
        })(),
        response: dbShape.response as APIV1Read.HttpResponse | null | undefined,
        responsesV2: dbShape.responsesV2 as APIV1Read.HttpResponsesV2 | null | undefined,
        errors: dbShape.errors ?? [],
        errorsV2: transformErrorsV2(dbShape),
        examples: dbShape.examples.map((example) =>
            convertExampleEndpointCall({ dbShape: example as APIV1Read.ExampleEndpointCall })
        ),
        description: dbShape.description,
        // htmlDescription: dbShape.htmlDescription,
        authed: dbShape.authed ?? false,
        authV2: dbShape.authV2,
        multiAuth: constructMultiAuth(dbShape),
        // descriptionContainsMarkdown: dbShape.descriptionContainsMarkdown,
        snippetTemplates: (dbShape as Record<string, unknown>).snippetTemplates,
        protocol: dbShape.protocol,
        includeInApiExplorer: dbShape.includeInApiExplorer ?? true
    } as APIV1Read.EndpointDefinition;
}

function constructMultiAuth(dbShape: APIV1Db.DbEndpointDefinition): APIV1Read.MultipleAuthType[] | undefined {
    if (dbShape.multiAuth != null) {
        return dbShape.multiAuth;
    }

    if (dbShape.authV2 != null) {
        if (dbShape.authV2.length === 0) {
            return [];
        }
        return dbShape.authV2.map((authSchemeId) => ({
            schemes: [authSchemeId]
        }));
    }

    if (dbShape.authed === true) {
        return [{ schemes: [AuthSchemeId("default")] }];
    }

    return undefined;
}

function transformErrorsV2(dbShape: APIV1Db.DbEndpointDefinition): APIV1Read.ErrorDeclarationV2[] | undefined {
    if (dbShape.errorsV2 != null) {
        return dbShape.errorsV2;
    }
    if (dbShape.errors != null) {
        return dbShape.errors.map((error): APIV1Read.ErrorDeclarationV2 => {
            return {
                isWildcard: undefined,
                name: undefined,
                examples: undefined,
                headers: undefined,
                ...error,
                type:
                    error.type != null
                        ? {
                              type: "alias",
                              value: error.type
                          }
                        : undefined
            };
        });
    }
    return undefined;
}

function transformHttpRequest({ dbShape }: { dbShape: APIV1Db.DbHttpRequest }): APIV1Read.HttpRequest {
    const typeType = dbShape.type.type;
    switch (typeType) {
        case "json":
        case "object":
        case "reference":
            return {
                contentType: dbShape.contentType ?? "application/json",
                description: dbShape.description,
                type: dbShape.type
            } as APIV1Read.HttpRequest;
        case "fileUpload": // deprecated
        case "formData":
            return {
                contentType: dbShape.contentType ?? "multipart/form-data",
                description: dbShape.description,
                type: dbShape.type
            } as APIV1Read.HttpRequest;
        case "bytes":
            return {
                contentType: dbShape.contentType ?? "application/octet-stream",
                description: dbShape.description,
                type: dbShape.type
            } as APIV1Read.HttpRequest;
        default:
            assertNever(typeType);
    }
}

export function convertExampleEndpointCall({
    dbShape
}: {
    dbShape: APIV1Read.ExampleEndpointCall;
}): APIV1Read.ExampleEndpointCall {
    return {
        name: dbShape.name,
        description: dbShape.description,
        // htmlDescription: dbShape.htmlDescription,
        // descriptionContainsMarkdown: true,
        path: dbShape.path,
        pathParameters: dbShape.pathParameters,
        queryParameters: dbShape.queryParameters,
        headers: dbShape.headers,
        requestBody: dbShape.requestBody,
        responseStatusCode: dbShape.responseStatusCode,
        responseBody: dbShape.responseBody,
        codeExamples: dbShape.codeExamples,
        requestBodyV3:
            dbShape.requestBodyV3 ??
            (dbShape.requestBody != null
                ? {
                      type: "json",
                      value: dbShape.requestBody
                  }
                : undefined),
        responseBodyV3:
            dbShape.responseBodyV3 ??
            (dbShape.responseBody != null
                ? {
                      type: "json",
                      value: dbShape.responseBody
                  }
                : undefined),
        codeSamples: dbShape.codeSamples ?? []
    };
}
