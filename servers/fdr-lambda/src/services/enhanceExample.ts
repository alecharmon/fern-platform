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
}

export interface EnhanceExampleResponse {
    enhancedRequestExample?: unknown;
    enhancedResponseExample?: unknown;
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
        timeout: 20000 // 20 seconds - must complete before API Gateway's 29s limit
    });

    const model = "gpt-4o-mini";
    const prompt = buildEnhancementPrompt(request);

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(
        `[enhanceExample] Starting OpenAI call for ${request.method} ${request.endpointPath} (org: ${request.organizationId})`
    );
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
                        "You are an API documentation expert. Your job is to replace ONLY generic placeholder values in API examples with realistic data. Do not add new fields, modify structure, or change data types. Only enhance existing placeholder values like 'string', 1, 0, true, false."
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
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.log("Model doesn't support JSON response format, falling back to regular format");
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
            const parsed = JSON.parse(enhancedContent);
            const elapsedMs = Date.now() - startTime;
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[enhanceExample] OpenAI call completed in ${elapsedMs}ms`);
            return {
                enhancedRequestExample: parsed.requestExample ?? request.originalRequestExample,
                enhancedResponseExample: parsed.responseExample ?? request.originalResponseExample,
                modelUsed: model,
                requestId
            };
        } catch (parseError) {
            const elapsedMs = Date.now() - startTime;
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.error(`Failed to parse OpenAI response as JSON after ${elapsedMs}ms: ${parseError}`);
            const error = new Error(`Failed to parse OpenAI response as JSON after ${elapsedMs}ms (model: ${model})`);
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
                    `OpenAI chat.completions timed out after 20000ms (model: ${model}, elapsed: ${elapsedMs}ms)`
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
    const parts: string[] = [
        "I need you to enhance API examples with realistic, meaningful data.",
        "",
        `**Endpoint**: ${request.method} ${request.endpointPath}`
    ];

    if (request.operationSummary) {
        parts.push(`**Operation**: ${request.operationSummary}`);
    }

    if (request.operationDescription) {
        parts.push(`**Description**: ${request.operationDescription}`);
    }

    parts.push("", "**Current Examples (auto-generated with generic data):**");

    if (request.originalRequestExample) {
        parts.push("", "**Request:**", "```json", JSON.stringify(request.originalRequestExample, null, 2), "```");
    }

    if (request.originalResponseExample) {
        parts.push("", "**Response:**", "```json", JSON.stringify(request.originalResponseExample, null, 2), "```");
    }

    parts.push(
        "",
        "**Instructions:**",
        "1. ONLY replace generic placeholder values like 'string', 1, 0, true, false with realistic data",
        "2. DO NOT add any new fields or properties that aren't already present",
        "3. DO NOT modify the JSON structure - keep it exactly the same",
        "4. DO NOT change data types (strings stay strings, numbers stay numbers, etc.)",
        "5. If a field has a meaningful value already, leave it unchanged",
        "6. For empty objects {}, leave them empty - do not add fields",
        "7. For empty arrays [], leave them empty - do not add items",
        "8. Make replacement values realistic for the API domain context",
        "",
        "**Example:**",
        '- Input: {"name": "string", "count": 1} → Output: {"name": "Rose Bush", "count": 25}',
        "- Input: {} → Output: {} (unchanged - don't add fields)",
        "- Input: [] → Output: [] (unchanged - don't add items)"
    );

    return parts.join("\n");
}
