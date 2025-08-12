import { describe, expect, it } from "vitest";

import { dynamic } from "@fern-api/dynamic-ir-sdk/api";

import { Language } from "../Language";
import { SnippetResolver } from "../SnippetResolver";
import { SnippetInput } from "../types";
import pythonFixture from "./fixtures/demo/python.json";
// Import fixture data
import typescriptFixture from "./fixtures/demo/typescript.json";

describe("SnippetResolver", () => {
  const createSnippetInputs = (): SnippetInput[] => [
    {
      language: "typescript",
      ir: typescriptFixture.dynamicIR as unknown as dynamic.DynamicIntermediateRepresentation,
      config: {},
    },
    {
      language: "python",
      ir: pythonFixture.dynamicIR as unknown as dynamic.DynamicIntermediateRepresentation,
      config: {},
    },
  ];

  it("should create a SnippetResolver with snippet inputs", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    expect(resolver).toBeInstanceOf(SnippetResolver);
  });

  it("should get SDK for typescript language", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    const typescriptSDK = resolver.sdk("typescript");
    expect(typescriptSDK).toBeDefined();
  });

  it("should get SDK for python language", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    const pythonSDK = resolver.sdk("python");
    expect(pythonSDK).toBeDefined();
  });

  it("should throw error for unsupported language", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });

    expect(() => {
      resolver.sdk("unsupported" as Language);
    }).toThrow("No configuration found for language: unsupported");
  });

  it("should throw error for language without snippet input", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });

    expect(() => {
      resolver.sdk("go");
    }).toThrow("No configuration found for language: go");
  });
});

describe("EndpointProvider", () => {
  const createSnippetInputs = (): SnippetInput[] => [
    {
      language: "typescript",
      ir: typescriptFixture.dynamicIR as unknown as dynamic.DynamicIntermediateRepresentation,
      config: {},
    },
    {
      language: "python",
      ir: pythonFixture.dynamicIR as unknown as dynamic.DynamicIntermediateRepresentation,
      config: {},
    },
  ];

  it("should create endpoint snippet generator for typescript", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    const typescriptSDK = resolver.sdk("typescript");

    const endpointGenerator = typescriptSDK.endpoint("GET /users");
    expect(endpointGenerator).toBeDefined();
  });

  it("should create endpoint snippet generator for python", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    const pythonSDK = resolver.sdk("python");

    const endpointGenerator = pythonSDK.endpoint("GET /users");
    expect(endpointGenerator).toBeDefined();
  });

  it("should throw error for invalid endpoint format", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    const typescriptSDK = resolver.sdk("typescript");

    expect(() => {
      typescriptSDK.endpoint("invalid-endpoint");
    }).toThrow('Invalid endpoint reference: "invalid-endpoint"');
  });
});

describe("EndpointSnippetGenerator", () => {
  const createSnippetInputs = (): SnippetInput[] => [
    {
      language: "typescript",
      ir: typescriptFixture.dynamicIR as unknown as dynamic.DynamicIntermediateRepresentation,
      config: {},
    },
  ];

  it("should generate snippets synchronously", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    const typescriptSDK = resolver.sdk("typescript");

    const endpointGenerator = typescriptSDK.endpoint("GET /users");

    // Provide a custom request since fixture doesn't have default examples
    const request = {
      environment: "Default" as const,
      auth: {
        type: "bearer" as const,
        token: "123",
      },
      pathParameters: {},
      queryParameters: {},
      headers: {},
      requestBody: undefined,
    };

    const snippet = endpointGenerator.generateSync(request);

    expect(snippet).toBeDefined();
    expect(snippet.snippet).toBeDefined();
  });

  it("should generate snippets asynchronously", async () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    const typescriptSDK = resolver.sdk("typescript");

    const endpointGenerator = typescriptSDK.endpoint("GET /users");

    // Provide a custom request since fixture doesn't have default examples
    const request = {
      environment: "Default" as const,
      auth: {
        type: "bearer" as const,
        token: "123",
      },
      pathParameters: {},
      queryParameters: {},
      headers: {},
      requestBody: undefined,
    };

    const snippet = await endpointGenerator.generate(request);

    expect(snippet).toBeDefined();
    expect(snippet.snippet).toBeDefined();
  });

  it("should handle different HTTP methods", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });
    const typescriptSDK = resolver.sdk("typescript");

    const getEndpoint = typescriptSDK.endpoint("GET /users");
    const postEndpoint = typescriptSDK.endpoint("POST /users");

    expect(getEndpoint).toBeDefined();
    expect(postEndpoint).toBeDefined();
  });
});

describe("Integration Tests", () => {
  const createSnippetInputs = (): SnippetInput[] => [
    {
      language: "typescript",
      ir: typescriptFixture.dynamicIR as unknown as dynamic.DynamicIntermediateRepresentation,
      config: {},
    },
    {
      language: "python",
      ir: pythonFixture.dynamicIR as unknown as dynamic.DynamicIntermediateRepresentation,
      config: {},
    },
  ];

  it("should generate snippets for multiple languages", () => {
    const snippetInputs = createSnippetInputs();
    const resolver = new SnippetResolver({ snippetInputs });

    const typescriptSDK = resolver.sdk("typescript");
    const pythonSDK = resolver.sdk("python");

    const tsEndpoint = typescriptSDK.endpoint("GET /users");
    const pyEndpoint = pythonSDK.endpoint("GET /users");

    // Provide custom requests since fixtures don't have default examples
    const request = {
      environment: "Default" as const,
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

    console.log("TS SNIPPET:", tsSnippet);
    console.log("PY SNIPPET:", pySnippet);

    expect(tsSnippet).toBeDefined();
    expect(pySnippet).toBeDefined();
    expect(tsSnippet.snippet).not.toBe(pySnippet.snippet);
  });

  it("should handle custom configuration", () => {
    const snippetInputs: SnippetInput[] = [
      {
        language: "typescript",
        ir: typescriptFixture.dynamicIR as unknown as dynamic.DynamicIntermediateRepresentation,
        config: {
          workspaceName: "CustomWorkspace",
          organization: "CustomOrg",
        },
      },
    ];

    const resolver = new SnippetResolver({ snippetInputs });
    const typescriptSDK = resolver.sdk("typescript");

    expect(typescriptSDK).toBeDefined();
  });
});
