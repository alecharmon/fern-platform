import type { EndpointDefinition, ExampleEndpointCall } from "../latest";
import { EndpointId } from "../latest";
import { getHarRequest } from "./get-har-request";

describe("getHarRequest", () => {
    it("preserves array JSON request body", () => {
        const endpoint: EndpointDefinition = {
            id: EndpointId("test-endpoint"),
            displayName: "Test Endpoint",
            operationId: undefined,
            description: undefined,
            availability: undefined,
            method: "POST",
            path: [{ type: "literal", value: "/test" }],
            defaultEnvironment: undefined,
            environments: undefined,
            pathParameters: undefined,
            queryParameters: undefined,
            requestHeaders: undefined,
            responseHeaders: undefined,
            requests: undefined,
            responses: undefined,
            errors: undefined,
            auth: undefined,
            multiAuth: undefined,
            examples: undefined,
            snippetTemplates: undefined,
            protocol: undefined,
            namespace: undefined,
            includeInApiExplorer: undefined
        };

        const example: ExampleEndpointCall = {
            name: undefined,
            description: "",
            path: "/test",
            pathParameters: undefined,
            queryParameters: undefined,
            headers: undefined,
            requestBody: {
                type: "json",
                value: [
                    {
                        id: "5df263b7db5a7e6ea03fae9b",
                        name: "How to reset your password",
                        content:
                            '# How to reset your password\n\n1. Go to the login page\n2. Click on the "Forgot password" link\n3. Follow the instructions',
                        knowledge_source_id: "5df263b7db5a7e6ea03fae9b"
                    }
                ]
            },
            responseStatusCode: 200,
            responseBody: undefined,
            snippets: undefined
        };

        const harRequest = getHarRequest(endpoint, example, {}, example.requestBody ?? undefined);

        expect(harRequest.postData?.text).toBeDefined();
        const parsedBody = JSON.parse(harRequest.postData!.text!);

        expect(Array.isArray(parsedBody)).toBe(true);
        expect(parsedBody).toHaveLength(1);
        expect(parsedBody[0]).toEqual({
            id: "5df263b7db5a7e6ea03fae9b",
            name: "How to reset your password",
            content:
                '# How to reset your password\n\n1. Go to the login page\n2. Click on the "Forgot password" link\n3. Follow the instructions',
            knowledge_source_id: "5df263b7db5a7e6ea03fae9b"
        });

        expect(harRequest.postData!.text!.trim()).toMatch(/^\[/);
        expect(harRequest.postData!.text!.trim()).toMatch(/\]$/);
    });

    it("preserves object JSON request body", () => {
        const endpoint: EndpointDefinition = {
            id: EndpointId("test-endpoint"),
            displayName: "Test Endpoint",
            operationId: undefined,
            description: undefined,
            availability: undefined,
            method: "POST",
            path: [{ type: "literal", value: "/test" }],
            defaultEnvironment: undefined,
            environments: undefined,
            pathParameters: undefined,
            queryParameters: undefined,
            requestHeaders: undefined,
            responseHeaders: undefined,
            requests: undefined,
            responses: undefined,
            errors: undefined,
            auth: undefined,
            multiAuth: undefined,
            examples: undefined,
            snippetTemplates: undefined,
            protocol: undefined,
            namespace: undefined,
            includeInApiExplorer: undefined
        };

        const example: ExampleEndpointCall = {
            name: undefined,
            description: "",
            path: "/test",
            pathParameters: undefined,
            queryParameters: undefined,
            headers: undefined,
            requestBody: {
                type: "json",
                value: {
                    name: "John Doe",
                    email: "john@example.com"
                }
            },
            responseStatusCode: 200,
            responseBody: undefined,
            snippets: undefined
        };

        const harRequest = getHarRequest(endpoint, example, {}, example.requestBody ?? undefined);

        expect(harRequest.postData?.text).toBeDefined();
        const parsedBody = JSON.parse(harRequest.postData!.text!);
        expect(Array.isArray(parsedBody)).toBe(false);
        expect(parsedBody).toEqual({
            name: "John Doe",
            email: "john@example.com"
        });
    });

    it("filters out empty object properties from object request body", () => {
        const endpoint: EndpointDefinition = {
            id: EndpointId("test-endpoint"),
            displayName: "Test Endpoint",
            operationId: undefined,
            description: undefined,
            availability: undefined,
            method: "POST",
            path: [{ type: "literal", value: "/test" }],
            defaultEnvironment: undefined,
            environments: undefined,
            pathParameters: undefined,
            queryParameters: undefined,
            requestHeaders: undefined,
            responseHeaders: undefined,
            requests: undefined,
            responses: undefined,
            errors: undefined,
            auth: undefined,
            multiAuth: undefined,
            examples: undefined,
            snippetTemplates: undefined,
            protocol: undefined,
            namespace: undefined,
            includeInApiExplorer: undefined
        };

        const example: ExampleEndpointCall = {
            name: undefined,
            description: "",
            path: "/test",
            pathParameters: undefined,
            queryParameters: undefined,
            headers: undefined,
            requestBody: {
                type: "json",
                value: {
                    name: "John Doe",
                    email: "john@example.com",
                    emptyObject: {},
                    validArray: [1, 2, 3],
                    validObject: { key: "value" }
                }
            },
            responseStatusCode: 200,
            responseBody: undefined,
            snippets: undefined
        };

        const harRequest = getHarRequest(endpoint, example, {}, example.requestBody ?? undefined);

        expect(harRequest.postData?.text).toBeDefined();
        const parsedBody = JSON.parse(harRequest.postData!.text!);
        expect(parsedBody).toEqual({
            name: "John Doe",
            email: "john@example.com",
            validArray: [1, 2, 3],
            validObject: { key: "value" }
        });
        expect(parsedBody).not.toHaveProperty("emptyObject");
    });
});
