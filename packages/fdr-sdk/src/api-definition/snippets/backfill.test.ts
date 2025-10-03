import { describe, expect, it } from "vitest";

import { ApiDefinition, ApiDefinitionId, EndpointId, EnvironmentId } from "../latest";
import { backfillSnippets } from "./backfill";

describe("backfillSnippets", () => {
    it("should backfill snippets for a search endpoint example", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            endpoints: {
                [EndpointId("search")]: {
                    id: EndpointId("search"),
                    method: "POST",
                    path: [{ type: "literal", value: "/" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    examples: [
                        {
                            name: "Basic Search",
                            description: "",
                            path: "/",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    RecordCount: 50,
                                    DocumentSearchParams: {
                                        SearchTerms: {
                                            All: ["data security"],
                                            Any: ["cyberattack", "breach"],
                                            None: ["ransomware"]
                                        },
                                        DocumentDateRangeStart: "2023-01-01T00:00:00Z",
                                        DocumentDateRangeEnd: "2023-12-31T23:59:59Z"
                                    }
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    TotalDocumentCount: 833494,
                                    NotReturnedDocumentCount: 0,
                                    ReturnedDocumentCount: 2,
                                    TruncatedDocumentCount: 0,
                                    Documents: [
                                        {
                                            IsTruncated: false,
                                            DocumentID: 77187402516,
                                            DocumentType: "NEWS",
                                            UploadDate: "2024-10-22T16:54:36Z",
                                            DocumentDate: "2024-10-22T15:17:54Z",
                                            DocumentName: "Wall Street Continues to See Recent Rally Cooling",
                                            DocumentText: "U.S. stocks dropped again on Tuesday...",
                                            AuthorName: "Natalie Venegas",
                                            DocumentSourceURL:
                                                "https://www.newsweek.com/wall-street-continues-see-recent-rally-cooling-1972948",
                                            DocumentImageURL:
                                                "https://d.newsweek.com/en/full/2501402/new-york-stock-exchange.jpg",
                                            LanguageID: "en",
                                            DocumentSentimentScore: "-13",
                                            ContainsViolence: true
                                        }
                                    ],
                                    FavIcons: {
                                        NEWS: "https://d1hgo075dbsz4i.cloudfront.net/21f4f43585ea45aa539034866e692e21/a/News/dsicon"
                                    }
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            usesApplicationJsonInFormDataValue: false,
            isHttpSnippetsEnabled: true,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        // Verify the result has the expected structure
        const endpoint = result.endpoints[EndpointId("search")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        // Verify snippets were generated
        const snippets = example?.snippets;
        expect(snippets).toBeDefined();
        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        // Verify curl snippet contains expected content
        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("curl");
        expect(curlSnippet?.code).toContain("POST");
        expect(curlSnippet?.code).toContain('"RecordCount": 50');
        expect(curlSnippet?.code).toContain('"data security"');

        expect(example?.snippets).toMatchSnapshot();
    });
});
