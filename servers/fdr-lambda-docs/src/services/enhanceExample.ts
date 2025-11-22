import OpenAI from "openai";

export interface EnhanceExampleRequest {
    method: string;
    endpointPath: string;
    organizationId: string;
    operationSummary?: string;
    operationDescription?: string;
    originalRequestExample?: unknown;
    originalResponseExample?: unknown;
    pathParameters?: Record<string, unknown>;
    queryParameters?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    openApiSpec?: string;
}

export interface EnhanceExampleResponse {
    enhancedRequestExample?: unknown;
    enhancedResponseExample?: unknown;
    modelUsed: string;
    requestId: string;
}

export interface EnhanceExampleBatchRequest {
    openApiSpec?: string;
    endpoints: EnhanceExampleRequest[];
}

export interface EnhanceExampleBatchResult {
    enhancedRequestExample?: unknown;
    enhancedResponseExample?: unknown;
    error?: string;
}

export interface EnhanceExampleBatchResponse {
    results: EnhanceExampleBatchResult[];
    modelUsed: string;
    requestId: string;
}

export async function enhanceExample(
    request: EnhanceExampleRequest,
    requestId: string
): Promise<EnhanceExampleResponse> {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        const error = new Error("OPENAI_API_KEY environment variable is not set");
        error.name = "ConfigError";
        throw error;
    }

    const openai = new OpenAI({
        apiKey: openaiApiKey,
        timeout: 40000 // 40 seconds
    });

    const model = "gpt-4.1-mini";
    const prompt = buildEnhancementPrompt(request);

    const startTime = Date.now();

    try {
        // Try with JSON response format first, fall back if model doesn't support it
        let completion;
        const baseParams = {
            model,
            messages: [
                {
                    role: "system" as const,
                    content:
                        "Your job is to replace generic placeholder values in API examples with realistic data. Do not add new fields, modify structure, or change data types. Only enhance existing placeholder values like 'string', 1, 0, true, false with values that make sense. If an OpenAPI specification is provided, use it to fill the example schema, paying special attention to things like: descriptions, allowed values, min/max ranges, enum values, etc."
                },
                {
                    role: "user" as const,
                    content: prompt
                }
            ],
            temperature: 0.0 // Lower temperature for more consistent results
            // max_tokens: 500 // Reduced from 2000 - we only need short placeholder replacements
        };

        try {
            // Try with JSON response format (supported by gpt-4-turbo, gpt-3.5-turbo-1106+)
            completion = await openai.chat.completions.create({
                ...baseParams,
                response_format: { type: "json_object" }
            });
        } catch (jsonFormatError: unknown) {
            const errorMessage = jsonFormatError instanceof Error ? jsonFormatError.message : String(jsonFormatError);

            if (errorMessage.includes("response_format")) {
                // Fall back to regular format without JSON response format
                completion = await openai.chat.completions.create(baseParams);
            } else {
                throw jsonFormatError;
            }
        }

        const enhancedContent = completion.choices[0]?.message?.content;

        if (!enhancedContent) {
            const error = new Error(`No content received from OpenAI (model: ${model})`);
            error.name = "OpenAIEmptyResponse";
            throw error;
        }

        try {
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[enhanceExample] Raw OpenAI response: ${enhancedContent}`);
            const parsed = JSON.parse(enhancedContent);
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[enhanceExample] Parsed response: ${JSON.stringify(parsed, null, 2)}`);
            return {
                enhancedRequestExample: parsed.requestExample ?? request.originalRequestExample,
                enhancedResponseExample: parsed.responseExample ?? request.originalResponseExample,
                modelUsed: model,
                requestId
            };
        } catch (_parseError) {
            const error = new Error(`Failed to parse OpenAI response as JSON (model: ${model})`);
            error.name = "OpenAIResponseParseError";
            throw error;
        }
    } catch (error: unknown) {
        const elapsedMs = Date.now() - startTime;

        if (error && typeof error === "object" && "name" in error) {
            const errorName = (error as { name: string }).name;

            if (errorName === "AbortError" || errorName === "TimeoutError") {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.error(`OpenAI call timed out after ${elapsedMs}ms`);
                const timeoutError = new Error(
                    `OpenAI chat.completions timed out after 40000ms (model: ${model}, elapsed: ${elapsedMs}ms)`
                );
                timeoutError.name = "OpenAITimeout";
                throw timeoutError;
            }

            if ("status" in error) {
                const status = (error as { status: number }).status;
                const message = error instanceof Error ? error.message : String(error);

                if (status === 429) {
                    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                    console.error(`OpenAI rate limit exceeded after ${elapsedMs}ms`);
                    const rateLimitError = new Error(
                        `OpenAI rate limit exceeded (model: ${model}, elapsed: ${elapsedMs}ms)`
                    );
                    rateLimitError.name = "OpenAIRateLimited";
                    throw rateLimitError;
                } else if (status >= 400 && status < 500) {
                    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                    console.error(`OpenAI invalid request (${status}) after ${elapsedMs}ms: ${message}`);
                    const invalidError = new Error(
                        `OpenAI invalid request: ${message} (model: ${model}, status: ${status})`
                    );
                    invalidError.name = "OpenAIInvalidRequest";
                    throw invalidError;
                } else if (status >= 500) {
                    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                    console.error(`OpenAI server error (${status}) after ${elapsedMs}ms`);
                    const serverError = new Error(
                        `OpenAI server error (model: ${model}, status: ${status}, elapsed: ${elapsedMs}ms)`
                    );
                    serverError.name = "OpenAIServerError";
                    throw serverError;
                }
            }
        }

        if (error && typeof error === "object" && "name" in error && (error as { name: string }).name !== "Error") {
            throw error;
        }

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error(`Failed to enhance example after ${elapsedMs}ms: ${error}`);
        const genericError = new Error(
            `Failed to enhance example: ${error instanceof Error ? error.message : String(error)} (elapsed: ${elapsedMs}ms)`
        );
        genericError.name = "EnhancementError";
        throw genericError;
    }
}

function buildEnhancementPrompt(request: EnhanceExampleRequest): string {
    const hasSpec = !!request.openApiSpec;

    const parts: string[] = [
        "You are an API documentation assistant. Your task is to replace placeholder values in API examples with realistic, meaningful data" +
            (hasSpec ? " that matches the OpenAPI schema." : "."),
        "",
        "# Task",
        `Enhance examples for: ${request.method} ${request.endpointPath}`,
        request.operationSummary ? `Summary: ${request.operationSummary}` : "",
        request.operationDescription ? `Description: ${request.operationDescription}` : "",
        "",
        "# Rules",
        "- ONLY replace generic placeholders (e.g., 'string', 0, 1, true, false, etc.)",
        "- DO NOT add new fields that aren't in the originally example skeleton. If there is no request or response, do not add one.",
        "- DO NOT change the structure or data types",
        "- Use realistic values that fit the API domain" +
            (hasSpec ? " and match any schema constraints/descriptions in the OpenAPI schema" : ""),
        "",
        "# Example",
        ""
    ];

    if (hasSpec) {
        parts.push(
            "**OpenAPI Schema:**",
            "```yaml",
            "components:",
            "  schemas:",
            "    PlantRequest:",
            "      type: object",
            "      properties:",
            "        name:",
            "          type: string",
            "          example: Rose Bush",
            "        species:",
            "          type: string",
            "          example: Rosa rugosa",
            "        wateringFrequency:",
            "          type: integer",
            "          minimum: 1",
            "          maximum: 30",
            "        sunlightLevel:",
            "          type: string",
            "          enum: [full-sun, partial-shade, full-shade]",
            "    PlantResponse:",
            "      type: object",
            "      properties:",
            "        id:",
            "          type: string",
            "          format: uuid",
            "        name:",
            "          type: string",
            "        createdAt:",
            "          type: string",
            "          format: date-time",
            "        success:",
            "          type: boolean",
            "",
            "paths:",
            "  /api/plants:",
            "    post:",
            "      summary: Create a new plant",
            "      requestBody:",
            "        content:",
            "          application/json:",
            "            schema:",
            "              $ref: '#/components/schemas/PlantRequest'",
            "      responses:",
            "        200:",
            "          content:",
            "            application/json:",
            "              schema:",
            "                $ref: '#/components/schemas/PlantResponse'",
            "```",
            ""
        );
    }

    parts.push(
        "**Example input:**",
        "Request:",
        "{",
        '  "name": "string",',
        '  "species": "string",',
        '  "wateringFrequency": 0,',
        '  "sunlightLevel": "string"',
        "}",
        "",
        "Response:",
        "{",
        '  "id": "string",',
        '  "name": "string",',
        '  "createdAt": "string",',
        '  "success": true',
        "}",
        "",
        "**Expected output" +
            (hasSpec
                ? " (note this obeys the properties of the OpenAPI schema, since sunlightLevel is an enum, and wateringFrequency is an integer between 1 and 30)"
                : "") +
            ":" +
            "{",
        '  "requestExample": {',
        '    "name": "Monstera Deliciosa",',
        '    "species": "Monstera deliciosa",',
        '    "wateringFrequency": 7,',
        '    "sunlightLevel": "partial-shade"',
        "  },",
        '  "responseExample": {',
        '    "id": "550e8400-e29b-41d4-a716-446655440000",',
        '    "name": "Monstera Deliciosa",',
        '    "createdAt": "2024-03-15T14:30:00Z",',
        '    "success": true',
        "  }",
        "}",
        "",
        "---",
        "",
        "# Your Task"
    );

    if (hasSpec) {
        parts.push("", "**OpenAPI Schema:**", "```yaml", request.openApiSpec ?? "", "```");
    }

    parts.push(
        "",
        "**Input to enhance:**",
        "Request:",
        JSON.stringify(request.originalRequestExample, null, 2),
        "",
        "Response:",
        JSON.stringify(request.originalResponseExample, null, 2),
        "",
        "**Return only the JSON output in this exact format:**",
        "{",
        '  "requestExample": { ... },',
        '  "responseExample": { ... }',
        "}"
    );

    return parts.filter(Boolean).join("\n");
}

function buildBatchEnhancementPrompt(endpoints: EnhanceExampleRequest[], openApiSpec?: string): string {
    const hasSpec = !!openApiSpec;

    const parts: string[] = [
        "You are an API documentation assistant. Your task is to replace placeholder values in API examples with realistic, meaningful data" +
            (hasSpec ? " that matches the OpenAPI schema." : "."),
        "",
        "# Batch Task",
        `Enhance examples for ${endpoints.length} endpoints.`,
        "",
        "# Rules",
        "- ONLY replace generic placeholders (e.g., 'string', 0, 1, true, false, john@example.com)",
        "- DO NOT add new fields that aren't in the original example skeleton. If there is no request or response, do not add one.",
        "- DO NOT change the structure or data types",
        "- Use realistic values that fit the API domain" +
            (hasSpec ? " and match any schema constraints/descriptions in the OpenAPI schema" : ""),
        "- Return results in the EXACT same order as the input endpoints",
        ""
    ];

    if (hasSpec) {
        parts.push("**OpenAPI Schema:**", "```yaml", openApiSpec ?? "", "```", "");
    }

    parts.push("**Endpoints to enhance:**", "");

    for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        parts.push(
            `Endpoint ${i}:`,
            `- Method: ${endpoint.method}`,
            `- Path: ${endpoint.endpointPath}`,
            endpoint.operationSummary ? `- Summary: ${endpoint.operationSummary}` : "",
            endpoint.operationDescription ? `- Description: ${endpoint.operationDescription}` : "",
            "- Request:",
            JSON.stringify(endpoint.originalRequestExample, null, 2),
            "- Response:",
            JSON.stringify(endpoint.originalResponseExample, null, 2),
            ""
        );
    }

    parts.push(
        "**Return only the JSON output in this exact format:**",
        "{",
        '  "results": [',
        '    { "id": 0, "requestExample": { ... }, "responseExample": { ... } },',
        '    { "id": 1, "requestExample": { ... }, "responseExample": { ... } }',
        "  ]",
        "}",
        "",
        "**Important:**",
        "- Return exactly " + endpoints.length + " results in the same order",
        "- Include the id field (0-indexed) for each result",
        "- Only replace placeholder values, do not add new fields",
        "- Return only JSON, no prose, no backticks"
    );

    return parts.filter(Boolean).join("\n");
}

export async function enhanceExamplesBatch(
    request: EnhanceExampleBatchRequest,
    requestId: string
): Promise<EnhanceExampleBatchResponse> {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        const error = new Error("OPENAI_API_KEY environment variable is not set");
        error.name = "ConfigError";
        throw error;
    }

    const openai = new OpenAI({
        apiKey: openaiApiKey,
        timeout: 25000
    });

    const model = "gpt-4o-mini";
    const prompt = buildBatchEnhancementPrompt(request.endpoints, request.openApiSpec);

    const startTime = Date.now();

    try {
        let completion;
        const baseParams = {
            model,
            messages: [
                {
                    role: "system" as const,
                    content:
                        "Your job is to replace generic placeholder values in API examples with realistic data. Do not add new fields, modify structure, or change data types. Only enhance existing placeholder values like 'string', 1, 0, true, false with values that make sense. If an OpenAPI specification is provided, use it to fill the example schema, paying special attention to things like: descriptions, allowed values, min/max ranges, enum values, etc."
                },
                {
                    role: "user" as const,
                    content: prompt
                }
            ],
            temperature: 0.0
        };

        try {
            completion = await openai.chat.completions.create({
                ...baseParams,
                response_format: { type: "json_object" }
            });
        } catch (jsonFormatError: unknown) {
            const errorMessage = jsonFormatError instanceof Error ? jsonFormatError.message : String(jsonFormatError);

            if (errorMessage.includes("response_format")) {
                completion = await openai.chat.completions.create(baseParams);
            } else {
                throw jsonFormatError;
            }
        }

        const enhancedContent = completion.choices[0]?.message?.content;

        if (!enhancedContent) {
            const error = new Error(`No content received from OpenAI (model: ${model})`);
            error.name = "OpenAIEmptyResponse";
            throw error;
        }

        try {
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[enhanceExamplesBatch] Raw OpenAI response: ${enhancedContent}`);
            const parsed = JSON.parse(enhancedContent);
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[enhanceExamplesBatch] Parsed response: ${JSON.stringify(parsed, null, 2)}`);

            if (!parsed.results || !Array.isArray(parsed.results)) {
                throw new Error("Response does not contain results array");
            }

            if (parsed.results.length !== request.endpoints.length) {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.warn(
                    `[enhanceExamplesBatch] Expected ${request.endpoints.length} results but got ${parsed.results.length}`
                );
            }

            const results: EnhanceExampleBatchResult[] = [];
            for (let i = 0; i < request.endpoints.length; i++) {
                const endpoint = request.endpoints[i];
                const result = parsed.results[i];

                if (result) {
                    results.push({
                        enhancedRequestExample: result.requestExample ?? endpoint.originalRequestExample,
                        enhancedResponseExample: result.responseExample ?? endpoint.originalResponseExample
                    });
                } else {
                    results.push({
                        enhancedRequestExample: endpoint.originalRequestExample,
                        enhancedResponseExample: endpoint.originalResponseExample,
                        error: "Missing result from OpenAI response"
                    });
                }
            }

            return {
                results,
                modelUsed: model,
                requestId
            };
        } catch (_parseError) {
            const error = new Error(`Failed to parse OpenAI batch response as JSON (model: ${model})`);
            error.name = "OpenAIResponseParseError";
            throw error;
        }
    } catch (error: unknown) {
        const elapsedMs = Date.now() - startTime;

        if (error && typeof error === "object" && "name" in error) {
            const errorName = (error as { name: string }).name;

            if (errorName === "AbortError" || errorName === "TimeoutError") {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.error(`OpenAI batch call timed out after ${elapsedMs}ms`);
                const timeoutError = new Error(
                    `OpenAI chat.completions timed out after 25000ms (model: ${model}, elapsed: ${elapsedMs}ms)`
                );
                timeoutError.name = "OpenAITimeout";
                throw timeoutError;
            }

            if ("status" in error) {
                const status = (error as { status: number }).status;
                const message = error instanceof Error ? error.message : String(error);

                if (status === 429) {
                    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                    console.error(`OpenAI rate limit exceeded after ${elapsedMs}ms`);
                    const rateLimitError = new Error(
                        `OpenAI rate limit exceeded (model: ${model}, elapsed: ${elapsedMs}ms)`
                    );
                    rateLimitError.name = "OpenAIRateLimited";
                    throw rateLimitError;
                } else if (status >= 400 && status < 500) {
                    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                    console.error(`OpenAI invalid request (${status}) after ${elapsedMs}ms: ${message}`);
                    const invalidError = new Error(
                        `OpenAI invalid request: ${message} (model: ${model}, status: ${status})`
                    );
                    invalidError.name = "OpenAIInvalidRequest";
                    throw invalidError;
                } else if (status >= 500) {
                    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                    console.error(`OpenAI server error (${status}) after ${elapsedMs}ms`);
                    const serverError = new Error(
                        `OpenAI server error (model: ${model}, status: ${status}, elapsed: ${elapsedMs}ms)`
                    );
                    serverError.name = "OpenAIServerError";
                    throw serverError;
                }
            }
        }

        if (error && typeof error === "object" && "name" in error && (error as { name: string }).name !== "Error") {
            throw error;
        }

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error(`Failed to enhance batch after ${elapsedMs}ms: ${error}`);
        const genericError = new Error(
            `Failed to enhance batch: ${error instanceof Error ? error.message : String(error)} (elapsed: ${elapsedMs}ms)`
        );
        genericError.name = "EnhancementError";
        throw genericError;
    }
}
