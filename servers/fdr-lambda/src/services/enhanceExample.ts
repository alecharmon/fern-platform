import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

/**
 * Generates a JSON Schema from a JavaScript value.
 * Uses additionalProperties: false to prevent the model from adding extra fields.
 * @exported for testing
 */
export function generateJsonSchemaFromValue(value: unknown): Record<string, unknown> {
    if (value === null) {
        return { type: "null" };
    }
    if (value === undefined) {
        return {};
    }
    if (typeof value === "string") {
        return { type: "string" };
    }
    if (typeof value === "number") {
        return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
    }
    if (typeof value === "boolean") {
        return { type: "boolean" };
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return { type: "array", items: {} };
        }
        return {
            type: "array",
            items: generateJsonSchemaFromValue(value[0])
        };
    }
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return {
                type: "object",
                properties: {},
                additionalProperties: false
            };
        }
        const properties: Record<string, unknown> = {};
        for (const key of keys) {
            properties[key] = generateJsonSchemaFromValue(obj[key]);
        }
        return {
            type: "object",
            properties,
            required: keys,
            additionalProperties: false
        };
    }
    return {};
}

export interface EnhanceExampleRequest {
    method: string;
    endpointPath: string;
    organizationId: string;
    domain?: string;
    basepath?: string;
    operationSummary?: string;
    operationDescription?: string;
    originalRequestExample?: unknown;
    originalResponseExample?: unknown;
    pathParameters?: Record<string, unknown>;
    queryParameters?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    openApiSpec?: string;
    exampleStyleInstructions?: string;
}

export interface EnhanceExampleResponse {
    enhancedRequestExample?: unknown;
    enhancedResponseExample?: unknown;
    modelUsed: string;
    requestId: string;
}

// Bedrock client - initialized lazily for Lambda cold start optimization
let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
    if (bedrockClient) {
        return bedrockClient;
    }
    bedrockClient = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || "us-east-1"
    });
    return bedrockClient;
}

const BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-6";
const BEDROCK_TIMEOUT_MS = 40000;

/**
 * Mock Bedrock response for local development.
 * Activated via USE_MOCK_BEDROCK=true environment variable.
 * Replaces placeholder values: strings become "fern_test_mock", integers become 42, floats become 42.0.
 */
function mockBedrockResponse(request: EnhanceExampleRequest, requestId: string): EnhanceExampleResponse {
    // biome-ignore lint/suspicious/noConsole: intentional lambda logging
    console.log("[enhanceExample] Using MOCK Bedrock response (USE_MOCK_BEDROCK=true)");
    return {
        enhancedRequestExample: enhanceMockValues(request.originalRequestExample),
        enhancedResponseExample: enhanceMockValues(request.originalResponseExample),
        modelUsed: `${BEDROCK_MODEL_ID}-mock`,
        requestId
    };
}

/**
 * Recursively replace placeholder values with mock data.
 * Strings → "fern_test_mock", integers → 42, floats → 42.0, booleans unchanged.
 */
function enhanceMockValues(value: unknown): unknown {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === "string") {
        if (value === "string" || value === "") {
            return "fern_test_mock";
        }
        return value;
    }
    if (typeof value === "number") {
        if (Number.isInteger(value)) {
            return value === 0 ? 42 : value;
        }
        return value === 0.0 ? 42.0 : value;
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => enhanceMockValues(item));
    }
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(obj)) {
            result[key] = enhanceMockValues(obj[key]);
        }
        return result;
    }
    return value;
}

interface BedrockRawResult {
    requestExample: unknown;
    responseExample: unknown;
}

const MAX_BEDROCK_RETRIES = 1;

/**
 * Invoke Bedrock with the enhancement prompt and parse the JSON response.
 * This is separated from the main enhanceExample function so it can be retried
 * independently when validation fails.
 */
async function invokeBedrock(
    request: EnhanceExampleRequest,
    prompt: string,
    previousValidationIssues?: string[]
): Promise<BedrockRawResult> {
    const client = getBedrockClient();

    const systemPrompt =
        "Your job is to replace generic placeholder values in API examples with realistic data. Do not add new fields, modify structure, or change data types. Only enhance existing placeholder values like 'string', 1, 0, true, false with values that make sense. If an OpenAPI specification is provided, use it to fill the example schema, paying special attention to things like: descriptions, allowed values, min/max ranges, enum values, etc. Return ONLY valid JSON in the exact format requested.";

    const messages: Array<{ role: string; content: string }> = [{ role: "user", content: prompt }];

    // If retrying after validation failure, include the errors so the model can correct them
    if (previousValidationIssues != null && previousValidationIssues.length > 0) {
        messages.push(
            {
                role: "assistant",
                content: "Here is my previous response (which had validation issues):"
            },
            {
                role: "user",
                content: `Your previous response had the following validation issues:\n${previousValidationIssues.join("\n")}\n\nPlease fix these issues. Remember: do not add extra keys, do not remove existing keys, and keep the same data types as the original. Return ONLY valid JSON.`
            }
        );
    }

    const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        temperature: 0.0,
        messages,
        system: systemPrompt
    };

    const command = new InvokeModelCommand({
        modelId: BEDROCK_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(requestBody)
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);

    let response;
    try {
        response = await client.send(command, { abortSignal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const enhancedContent = responseBody.content?.[0]?.text;

    if (!enhancedContent) {
        const error = new Error(`No content received from Bedrock (model: ${BEDROCK_MODEL_ID})`);
        error.name = "BedrockEmptyResponse";
        throw error;
    }

    // biome-ignore lint/suspicious/noConsole: intentional lambda logging
    console.log(`[enhanceExample] Raw Bedrock response: ${enhancedContent}`);

    const jsonContent = extractJsonFromResponse(enhancedContent);
    const parsed = JSON.parse(jsonContent);

    // biome-ignore lint/suspicious/noConsole: intentional lambda logging
    console.log(`[enhanceExample] Parsed response: ${JSON.stringify(parsed, null, 2)}`);

    return {
        requestExample: parsed.requestExample ?? request.originalRequestExample,
        responseExample: parsed.responseExample ?? request.originalResponseExample
    };
}

/**
 * Validate a Bedrock result against the original examples and return validation issues.
 * Returns { valid: true } if the shape matches, or { valid: false, issues } with descriptions.
 */
function validateBedrockResult(
    result: BedrockRawResult,
    request: EnhanceExampleRequest
): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (request.originalRequestExample != null && result.requestExample != null) {
        collectShapeIssues(result.requestExample, request.originalRequestExample, "requestExample", issues);
    }
    if (request.originalResponseExample != null && result.responseExample != null) {
        collectShapeIssues(result.responseExample, request.originalResponseExample, "responseExample", issues);
    }

    return { valid: issues.length === 0, issues };
}

/**
 * Recursively collect shape validation issues between enhanced and original values.
 */
function collectShapeIssues(enhanced: unknown, original: unknown, path: string, issues: string[]): void {
    if (original === null || original === undefined || enhanced === null || enhanced === undefined) {
        return;
    }

    if (typeof enhanced !== typeof original) {
        issues.push(`${path}: type mismatch (expected ${typeof original}, got ${typeof enhanced})`);
        return;
    }

    if (typeof original !== "object") {
        return;
    }

    if (Array.isArray(original)) {
        if (!Array.isArray(enhanced)) {
            issues.push(`${path}: expected array, got object`);
            return;
        }
        if (original.length > 0) {
            for (let i = 0; i < enhanced.length; i++) {
                collectShapeIssues(enhanced[i], original[0], `${path}[${i}]`, issues);
            }
        }
        return;
    }

    const originalObj = original as Record<string, unknown>;
    const enhancedObj = enhanced as Record<string, unknown>;
    const originalKeys = Object.keys(originalObj);
    const enhancedKeys = new Set(Object.keys(enhancedObj));

    for (const key of enhancedKeys) {
        if (!(key in originalObj)) {
            issues.push(`${path}.${key}: extra key not in original`);
        }
    }

    for (const key of originalKeys) {
        if (!enhancedKeys.has(key)) {
            issues.push(`${path}.${key}: missing key`);
        } else {
            collectShapeIssues(enhancedObj[key], originalObj[key], `${path}.${key}`, issues);
        }
    }
}

export async function enhanceExample(
    request: EnhanceExampleRequest,
    requestId: string
): Promise<EnhanceExampleResponse> {
    // Support local mock mode for development without AWS credentials
    if (process.env.USE_MOCK_BEDROCK === "true") {
        return mockBedrockResponse(request, requestId);
    }

    const prompt = buildEnhancementPrompt(request);
    const startTime = Date.now();

    try {
        let result = await invokeBedrock(request, prompt);
        const validation = validateBedrockResult(result, request);

        if (!validation.valid) {
            // biome-ignore lint/suspicious/noConsole: intentional lambda logging
            console.warn(
                `[enhanceExample] Validation issues on first attempt: ${validation.issues.join(", ")}. Retrying...`
            );

            // Retry once — the model may produce a better result on a second attempt
            for (let retry = 0; retry < MAX_BEDROCK_RETRIES; retry++) {
                try {
                    const retryResult = await invokeBedrock(request, prompt, validation.issues);
                    const retryValidation = validateBedrockResult(retryResult, request);

                    if (retryValidation.valid) {
                        // biome-ignore lint/suspicious/noConsole: intentional lambda logging
                        console.log(`[enhanceExample] Retry ${retry + 1} passed validation.`);
                        result = retryResult;
                        break;
                    }

                    // biome-ignore lint/suspicious/noConsole: intentional lambda logging
                    console.warn(
                        `[enhanceExample] Retry ${retry + 1} still has issues: ${retryValidation.issues.join(", ")}`
                    );
                } catch (retryError) {
                    // biome-ignore lint/suspicious/noConsole: intentional lambda logging
                    console.warn(`[enhanceExample] Retry ${retry + 1} failed: ${retryError}`);
                }
            }

            // Even if retries failed, use validateShape to fix what we can
            result = {
                requestExample: validateShape(result.requestExample, request.originalRequestExample),
                responseExample: validateShape(result.responseExample, request.originalResponseExample)
            };

            // Final safety check — if the patched result is still invalid, fall back to originals entirely
            const finalValidation = validateBedrockResult(result, request);
            if (!finalValidation.valid) {
                // biome-ignore lint/suspicious/noConsole: intentional lambda logging
                console.warn(
                    `[enhanceExample] Patched result still invalid: ${finalValidation.issues.join(", ")}. Returning originals.`
                );
                result = {
                    requestExample: request.originalRequestExample,
                    responseExample: request.originalResponseExample
                };
            }
        }

        return {
            enhancedRequestExample: result.requestExample,
            enhancedResponseExample: result.responseExample,
            modelUsed: BEDROCK_MODEL_ID,
            requestId
        };
    } catch (error: unknown) {
        const elapsedMs = Date.now() - startTime;

        if (error && typeof error === "object" && "name" in error) {
            const errorName = (error as { name: string }).name;

            if (errorName === "AbortError" || errorName === "TimeoutError") {
                // biome-ignore lint/suspicious/noConsole: intentional lambda logging
                console.error(`Bedrock call timed out after ${elapsedMs}ms`);
                const timeoutError = new Error(
                    `Bedrock InvokeModel timed out after ${BEDROCK_TIMEOUT_MS}ms (model: ${BEDROCK_MODEL_ID}, elapsed: ${elapsedMs}ms)`
                );
                timeoutError.name = "BedrockTimeout";
                throw timeoutError;
            }

            if ("$metadata" in error) {
                const metadata = (error as { $metadata: { httpStatusCode?: number } }).$metadata;
                const status = metadata?.httpStatusCode;
                const message = error instanceof Error ? error.message : String(error);

                if (status === 429) {
                    // biome-ignore lint/suspicious/noConsole: intentional lambda logging
                    console.error(`Bedrock throttled after ${elapsedMs}ms`);
                    const rateLimitError = new Error(
                        `Bedrock throttled (model: ${BEDROCK_MODEL_ID}, elapsed: ${elapsedMs}ms)`
                    );
                    rateLimitError.name = "BedrockThrottled";
                    throw rateLimitError;
                }
                if (status != null && status >= 400 && status < 500) {
                    // biome-ignore lint/suspicious/noConsole: intentional lambda logging
                    console.error(`Bedrock client error (${status}) after ${elapsedMs}ms: ${message}`);
                    const clientError = new Error(
                        `Bedrock client error: ${message} (model: ${BEDROCK_MODEL_ID}, status: ${status})`
                    );
                    clientError.name = "BedrockClientError";
                    throw clientError;
                }
                if (status != null && status >= 500) {
                    // biome-ignore lint/suspicious/noConsole: intentional lambda logging
                    console.error(`Bedrock server error (${status}) after ${elapsedMs}ms`);
                    const serverError = new Error(
                        `Bedrock server error (model: ${BEDROCK_MODEL_ID}, status: ${status}, elapsed: ${elapsedMs}ms)`
                    );
                    serverError.name = "BedrockServerError";
                    throw serverError;
                }
            }
        }

        // Re-throw known error types
        if (error && typeof error === "object" && "name" in error && (error as { name: string }).name !== "Error") {
            throw error;
        }

        // biome-ignore lint/suspicious/noConsole: intentional lambda logging
        console.error(`Failed to enhance example after ${elapsedMs}ms: ${error}`);
        const genericError = new Error(
            `Failed to enhance example: ${error instanceof Error ? error.message : String(error)} (elapsed: ${elapsedMs}ms)`
        );
        genericError.name = "EnhancementError";
        throw genericError;
    }
}

/**
 * Validate that a parsed response matches the expected shape of the original value.
 * Checks that objects have the same keys and values have compatible types.
 * Returns the validated value if it matches, or the original if validation fails.
 */
function validateShape(enhanced: unknown, original: unknown): unknown {
    if (original === null || original === undefined) {
        return enhanced;
    }
    if (enhanced === null || enhanced === undefined) {
        return original;
    }

    // Type mismatch: return original
    if (typeof enhanced !== typeof original) {
        // biome-ignore lint/suspicious/noConsole: intentional lambda logging
        console.warn(
            `[enhanceExample] Type mismatch: expected ${typeof original}, got ${typeof enhanced}. Falling back to original.`
        );
        return original;
    }

    // Primitives: types match, accept enhanced
    if (typeof original !== "object") {
        return enhanced;
    }

    // Arrays: validate each item against the first original item's shape
    if (Array.isArray(original)) {
        if (!Array.isArray(enhanced)) {
            return original;
        }
        if (original.length === 0) {
            return enhanced;
        }
        // Validate each enhanced item against the shape of the first original item
        return enhanced.map((item) => validateShape(item, original[0]));
    }

    // Objects: ensure enhanced has exactly the same keys
    const originalObj = original as Record<string, unknown>;
    const enhancedObj = enhanced as Record<string, unknown>;
    const originalKeys = new Set(Object.keys(originalObj));
    const enhancedKeys = new Set(Object.keys(enhancedObj));

    // Check for extra keys in enhanced (model added fields it shouldn't have)
    for (const key of enhancedKeys) {
        if (!originalKeys.has(key)) {
            // biome-ignore lint/suspicious/noConsole: intentional lambda logging
            console.warn(`[enhanceExample] Extra key "${key}" in enhanced response, removing.`);
        }
    }

    // Check for missing keys in enhanced
    for (const key of originalKeys) {
        if (!enhancedKeys.has(key)) {
            // biome-ignore lint/suspicious/noConsole: intentional lambda logging
            console.warn(`[enhanceExample] Missing key "${key}" in enhanced response, using original.`);
        }
    }

    // Build validated object with only original keys, recursively validating each value
    const result: Record<string, unknown> = {};
    for (const key of originalKeys) {
        if (enhancedKeys.has(key)) {
            result[key] = validateShape(enhancedObj[key], originalObj[key]);
        } else {
            result[key] = originalObj[key];
        }
    }
    return result;
}

/**
 * Extract JSON from a response that may contain markdown code blocks.
 */
function extractJsonFromResponse(content: string): string {
    // Try to extract from ```json ... ``` blocks
    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch?.[1]) {
        return jsonBlockMatch[1].trim();
    }

    // Try to extract from ``` ... ``` blocks
    const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch?.[1]) {
        return codeBlockMatch[1].trim();
    }

    // Try to find a JSON object directly
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch?.[0]) {
        return jsonMatch[0].trim();
    }

    return content.trim();
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
            ":**",
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
        JSON.stringify(request.originalResponseExample, null, 2)
    );

    if (request.exampleStyleInstructions) {
        parts.push(
            "",
            "**Additionally, style the example following these instructions:**",
            request.exampleStyleInstructions
        );
    }

    parts.push(
        "",
        "**Return only the JSON output in this exact format:**",
        "{",
        '  "requestExample": { ... },',
        '  "responseExample": { ... }',
        "}"
    );

    return parts.filter(Boolean).join("\n");
}
