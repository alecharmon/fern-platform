import {
    type EndpointContext,
    type EndpointDefinition,
    EndpointId,
    EnvironmentId,
    PropertyKey
} from "@fern-api/fdr-sdk/api-definition";
import { ApiDefinitionId, type EndpointNode, NodeId, Slug } from "@fern-api/fdr-sdk/navigation";

import type { PlaygroundEndpointRequestFormState } from "../types";
import { CurlSnippetBuilder } from "./builders/curl";
import { PythonRequestSnippetBuilder } from "./builders/python";
import { TypescriptFetchSnippetBuilder } from "./builders/typescript";

// Mock File class for testing
class MockFile {
    constructor(
        public readonly name: string,
        public readonly type: string,
        public readonly lastModified: number = Date.now()
    ) {}

    // Required File interface properties
    public readonly size = 0;
    public readonly webkitRelativePath = "";
    public readonly arrayBuffer = async () => new ArrayBuffer(0);
    public readonly slice = () => new Blob();
    public readonly stream = () => new ReadableStream();
    public readonly text = async () => "";
    public readonly bytes = async () => new Uint8Array(0);
}

// mock file option
const mockFile = (name: string, type: string): MockFile => {
    return new MockFile(name, type);
};

describe("PlaygroundCodeSnippetBuilder", () => {
    const node: EndpointNode = {
        type: "endpoint",
        method: "POST",
        endpointId: EndpointId(""),
        isResponseStream: undefined,
        playground: undefined,
        title: "My endpoint",
        slug: Slug(""),
        canonicalSlug: undefined,
        icon: undefined,
        hidden: undefined,
        id: NodeId(""),
        apiDefinitionId: ApiDefinitionId(""),
        availability: undefined,
        authed: undefined,
        viewers: undefined,
        orphaned: undefined,
        featureFlags: undefined
    };

    const endpoint: EndpointDefinition = {
        id: EndpointId(""),
        auth: undefined,
        protocol: undefined,
        availability: undefined,
        defaultEnvironment: EnvironmentId("Prod"),
        environments: [
            {
                id: EnvironmentId("Prod"),
                baseUrl: "https://example.com"
            }
        ],
        displayName: "endpoint-1",
        operationId: "endpoint-1",
        method: "POST",
        path: [
            { type: "literal", value: "/test/" },
            { value: PropertyKey("test"), type: "pathParameter" }
        ],
        pathParameters: [
            {
                key: PropertyKey("test"),
                valueShape: {
                    type: "alias",
                    value: {
                        type: "primitive",
                        value: {
                            type: "string",
                            format: undefined,
                            regex: undefined,
                            minLength: undefined,
                            maxLength: undefined,
                            default: undefined
                        }
                    }
                },
                description: undefined,
                availability: undefined,
                propertyAccess: undefined
            }
        ],
        queryParameters: undefined,
        requestHeaders: undefined,
        requests: undefined,
        responses: undefined,
        errors: [],
        examples: [],
        snippetTemplates: undefined,
        description: undefined,
        responseHeaders: undefined,
        namespace: undefined,
        multiAuth: undefined,
        includeInApiExplorer: true
    };

    const formState: PlaygroundEndpointRequestFormState = {
        type: "endpoint",
        headers: {
            Accept: "application/json",
            Test: "test"
        },
        pathParameters: {
            test: "hello@example"
        },
        queryParameters: {},
        body: {
            type: "json",
            value: {
                test: "hello",
                deeply: {
                    nested: 1
                }
            }
        }
    };

    const context: EndpointContext = {
        node,
        endpoint,
        auths: [],
        types: {},
        globalHeaders: [],
        authsWithKeys: [],
        authOptions: [],
        authOptionEntries: []
    };

    const multipartFormState: PlaygroundEndpointRequestFormState = {
        type: "endpoint",
        headers: {
            Accept: "application/json",
            "Content-Type": "multipart/form-data"
        },
        pathParameters: {
            test: "hello@example"
        },
        queryParameters: {},
        body: {
            type: "form-data",
            value: {
                file1: {
                    type: "file",
                    value: mockFile("test.txt", "text/plain")
                },
                file2: {
                    type: "fileArray",
                    value: [mockFile("image1.jpg", "image/jpeg"), mockFile("image2.jpg", "image/jpeg")]
                },
                textField: {
                    type: "json",
                    value: "simple string value"
                },
                jsonField: {
                    type: "json",
                    value: {
                        nested: {
                            value: 123
                        }
                    }
                }
            }
        }
    };

    const multipartFormStateWithoutFiles: PlaygroundEndpointRequestFormState = {
        type: "endpoint",
        headers: {
            Accept: "application/json",
            "Content-Type": "multipart/form-data"
        },
        pathParameters: {
            test: "hello@example"
        },
        queryParameters: {},
        body: {
            type: "form-data",
            value: {
                textField: {
                    type: "json",
                    value: "simple string value"
                },
                jsonField: {
                    type: "json",
                    value: {
                        nested: {
                            value: 123
                        }
                    }
                }
            }
        }
    };

    it("should render curl", () => {
        expect(new CurlSnippetBuilder(context, formState, {}, undefined, false).build()).toMatchSnapshot();
    });

    it("should render python", () => {
        expect(new PythonRequestSnippetBuilder(context, formState, {}, undefined, false).build()).toMatchSnapshot();
    });

    it("should render typescript", () => {
        expect(new TypescriptFetchSnippetBuilder(context, formState, {}, undefined, false).build()).toMatchSnapshot();
    });

    it("should render python with multipart form data", () => {
        expect(
            new PythonRequestSnippetBuilder(context, multipartFormState, {}, undefined, false).build()
        ).toMatchSnapshot();
    });

    it("should render python with multipart form data without files", () => {
        expect(
            new PythonRequestSnippetBuilder(context, multipartFormStateWithoutFiles, {}, undefined, false).build()
        ).toMatchSnapshot();
    });
});
