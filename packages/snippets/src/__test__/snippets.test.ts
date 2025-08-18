import { describe, expect, it } from "vitest";

import { dynamic } from "@fern-api/dynamic-ir-sdk/api";

import { SnippetResolver } from "../SnippetResolver";
import { SnippetInput } from "../types";
import javaFixture from "./fixtures/demo/java.json";
import pythonFixture from "./fixtures/demo/python.json";
import typescriptFixture from "./fixtures/demo/typescript.json";

describe("Integration Tests", () => {
  const createSnippetInputs = (): SnippetInput[] => [
    {
      language: "typescript",
      ir: typescriptFixture as unknown as dynamic.DynamicIntermediateRepresentation,
    },
    {
      language: "python",
      ir: pythonFixture as unknown as dynamic.DynamicIntermediateRepresentation,
    },
    {
      language: "java",
      ir: javaFixture as unknown as dynamic.DynamicIntermediateRepresentation,
    },
  ];

  it("should generate snippets for multiple languages", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });

    const typescriptSDK = resolver.sdk("typescript");
    const pythonSDK = resolver.sdk("python");
    const javaSDK = resolver.sdk("java");

    const tsEndpoint = typescriptSDK.endpoint("GET /users");
    const pyEndpoint = pythonSDK.endpoint("GET /users");
    const javaEnpoint = javaSDK.endpoint("GET /users");

    // Provide custom requests since fixtures don't have default examples
    const request = {
      baseURL: "https://api.example.com" as const,
      auth: {
        type: "bearer" as const,
        token: "123",
      },
      pathParameters: {},
      queryParameters: {},
      headers: {},
      requestBody: undefined,
    };

    const tsSnippet = tsEndpoint.generateSync(request);
    const pySnippet = pyEndpoint.generateSync(request);
    const javaSnippet = javaEnpoint.generateSync(request);

    expect(tsSnippet).toBeDefined();
    expect(pySnippet).toBeDefined();
    expect(javaSnippet).toBeDefined();
    expect(tsSnippet.snippet).not.toBe(pySnippet.snippet);

    // Snapshot testing for each language
    expect(tsSnippet.snippet).toMatchSnapshot("typescript-snippet");
    expect(pySnippet.snippet).toMatchSnapshot("python-snippet");
    expect(javaSnippet.snippet).toMatchSnapshot("java-snippet");
  });

  it("should generate different snippets for different endpoints", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });

    const typescriptSDK = resolver.sdk("typescript");

    const getUsersEndpoint = typescriptSDK.endpoint("GET /users");
    const createUserEndpoint = typescriptSDK.endpoint("POST /users");

    const request = {
      baseURL: "https://api.example.com" as const,
      auth: {
        type: "bearer" as const,
        token: "123",
      },
      pathParameters: {},
      queryParameters: {},
      headers: {},
      requestBody: undefined,
    };

    const getUsersSnippet = getUsersEndpoint.generateSync(request);
    const createUserSnippet = createUserEndpoint.generateSync(request);

    expect(getUsersSnippet).toBeDefined();
    expect(createUserSnippet).toBeDefined();
    expect(getUsersSnippet.snippet).not.toBe(createUserSnippet.snippet);

    // Snapshot testing for different endpoints
    expect(getUsersSnippet.snippet).toMatchSnapshot("get-users-endpoint");
    expect(createUserSnippet.snippet).toMatchSnapshot("create-user-endpoint");
  });

  it("should handle different request types correctly", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });

    const typescriptSDK = resolver.sdk("typescript");
    const endpoint = typescriptSDK.endpoint("GET /users");

    // Test with query parameters
    const requestWithQuery = {
      baseURL: "https://api.example.com" as const,
      auth: {
        type: "bearer" as const,
        token: "123",
      },
      pathParameters: {},
      queryParameters: {
        page: 1,
        limit: 10,
        sort: "name",
      },
      headers: {},
      requestBody: undefined,
    };

    const snippetWithQuery = endpoint.generateSync(requestWithQuery);
    expect(snippetWithQuery).toBeDefined();
    expect(snippetWithQuery.snippet).toBeDefined();

    // Snapshot testing for query parameters
    expect(snippetWithQuery.snippet).toMatchSnapshot(
      "query-parameters-snippet"
    );
  });

  it("should generate snippets with custom config", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });

    const typescriptSDK = resolver.sdk("typescript");
    const endpoint = typescriptSDK.endpoint("GET /users");

    const request = {
      baseURL: "https://api.example.com" as const,
      auth: {
        type: "bearer" as const,
        token: "123",
      },
      pathParameters: {},
      queryParameters: {},
      headers: {},
      requestBody: undefined,
    };

    const snippet = endpoint.generateSync(request);

    // Verify the snippet structure
    expect(snippet).toHaveProperty("snippet");
    expect(snippet.snippet).toBeDefined();

    // Snapshot testing for basic snippet
    expect(snippet.snippet).toMatchSnapshot("basic-snippet");
  });

  it("should handle different languages with appropriate configurations", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });

    // Test TypeScript
    const tsSDK = resolver.sdk("typescript");
    const tsEndpoint = tsSDK.endpoint("GET /users");

    // Test Python
    const pySDK = resolver.sdk("python");
    const pyEndpoint = pySDK.endpoint("GET /users");

    const request = {
      baseURL: "https://api.example.com" as const,
      auth: {
        type: "bearer" as const,
        token: "123",
      },
      pathParameters: {},
      queryParameters: {},
      headers: {},
      requestBody: undefined,
    };

    const tsSnippet = tsEndpoint.generateSync(request);
    const pySnippet = pyEndpoint.generateSync(request);

    // Both should generate valid snippets
    expect(tsSnippet.snippet).toBeDefined();
    expect(pySnippet.snippet).toBeDefined();

    // They should be different due to language-specific generation
    expect(tsSnippet.snippet).not.toEqual(pySnippet.snippet);

    // Snapshot testing for language comparison
    expect(tsSnippet.snippet).toMatchSnapshot("typescript-language-snippet");
    expect(pySnippet.snippet).toMatchSnapshot("python-language-snippet");
  });
});
