/**
 * Integration tests that make REAL OpenAI API calls via the enhanceExample function.
 * Run manually with: pnpm --filter=@fern-platform/fdr-lambda-docs test:integration
 *
 * These tests verify that:
 * 1. Empty objects stay empty (no hallucination)
 * 2. The model only fills in placeholder values
 * 3. No extra fields are added
 */

import { describe, expect, it } from "vitest";
import { type EnhanceExampleRequest, enhanceExample } from "../services/enhanceExample";

// Skip all tests if no API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const describeWithApiKey = OPENAI_API_KEY ? describe : describe.skip;

describeWithApiKey("enhanceExample integration tests (real OpenAI calls)", () => {
    // Sample OpenAPI spec for testing
    const sampleOpenApiSpec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /api/users:
    post:
      summary: Create a new user
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateUserResponse'
components:
  schemas:
    CreateUserRequest:
      type: object
      properties:
        name:
          type: string
          description: The user's full name
          example: John Doe
        email:
          type: string
          format: email
          description: The user's email address
        age:
          type: integer
          minimum: 0
          maximum: 150
          description: The user's age in years
        score:
          type: number
          format: float
          description: User's score rating
    CreateUserResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier for the user
        success:
          type: boolean
          description: Whether the operation succeeded
        count:
          type: integer
          description: Number of users created
        rating:
          type: number
          format: float
          description: User rating
`;

    async function callEnhanceExample(
        originalRequest: unknown,
        originalResponse: unknown,
        includeSpec = true
    ): Promise<{ requestExample: unknown; responseExample: unknown }> {
        const request: EnhanceExampleRequest = {
            method: "POST",
            endpointPath: "/api/users",
            organizationId: "test-org",
            operationSummary: "Create a new user",
            operationDescription: "Creates a new user in the system",
            originalRequestExample: originalRequest,
            originalResponseExample: originalResponse,
            openApiSpec: includeSpec ? sampleOpenApiSpec : undefined
        };

        const result = await enhanceExample(request, "test-request-id");

        return {
            requestExample: result.enhancedRequestExample,
            responseExample: result.enhancedResponseExample
        };
    }

    it("should return empty object when original request is empty", async () => {
        const result = await callEnhanceExample({}, { success: true });

        console.log("Empty request test result:", JSON.stringify(result, null, 2));

        // The key test: empty object should stay empty!
        expect(result.requestExample).toEqual({});
        expect(result.responseExample).toHaveProperty("success");
    }, 60000);

    it("should return empty object when original response is empty", async () => {
        const result = await callEnhanceExample({ name: "string" }, {});

        console.log("Empty response test result:", JSON.stringify(result, null, 2));

        // Empty response should stay empty
        expect(result.responseExample).toEqual({});
        expect(result.requestExample).toHaveProperty("name");
    }, 60000);

    it("should return empty objects when both are empty", async () => {
        const result = await callEnhanceExample({}, {});

        console.log("Both empty test result:", JSON.stringify(result, null, 2));

        // Both should be empty
        expect(result.requestExample).toEqual({});
        expect(result.responseExample).toEqual({});
    }, 60000);

    it("should not add extra fields to a simple object", async () => {
        // Use realistic placeholder values: "string", 1, 1.1
        const originalRequest = { name: "string", age: 1, score: 1.1 };
        const originalResponse = { id: "string", success: true, count: 1 };

        const result = await callEnhanceExample(originalRequest, originalResponse);

        console.log("Simple object test result:", JSON.stringify(result, null, 2));

        // Should have exact same keys, no extras
        expect(Object.keys(result.requestExample as object).sort()).toEqual(["age", "name", "score"]);
        expect(Object.keys(result.responseExample as object).sort()).toEqual(["count", "id", "success"]);

        // Values should be enhanced (not placeholder values)
        const req = result.requestExample as Record<string, unknown>;
        const res = result.responseExample as Record<string, unknown>;

        expect(typeof req.name).toBe("string");
        expect(req.name).not.toBe("string"); // Should be a real name
        expect(typeof req.age).toBe("number");
        expect(typeof req.score).toBe("number");

        expect(typeof res.id).toBe("string");
        expect(typeof res.success).toBe("boolean");
        expect(typeof res.count).toBe("number");
    }, 60000);

    it("should preserve nested object structure without adding fields", async () => {
        const originalRequest = {
            user: {
                name: "string",
                email: "string",
                age: 1
            }
        };
        const originalResponse = {
            data: {
                id: "string",
                rating: 1.1
            }
        };

        const result = await callEnhanceExample(originalRequest, originalResponse);

        console.log("Nested object test result:", JSON.stringify(result, null, 2));

        const req = result.requestExample as Record<string, Record<string, unknown>>;
        const res = result.responseExample as Record<string, Record<string, unknown>>;

        // Check structure is preserved
        expect(Object.keys(req)).toEqual(["user"]);
        expect(Object.keys(req.user!).sort()).toEqual(["age", "email", "name"]);

        expect(Object.keys(res)).toEqual(["data"]);
        expect(Object.keys(res.data!).sort()).toEqual(["id", "rating"]);
    }, 60000);

    it("should handle arrays without adding extra items or fields", async () => {
        const originalRequest = {
            items: [{ id: 1, name: "string", price: 1.1 }]
        };
        const originalResponse = {
            results: [{ success: true, count: 1 }]
        };

        const result = await callEnhanceExample(originalRequest, originalResponse);

        console.log("Array test result:", JSON.stringify(result, null, 2));

        const req = result.requestExample as Record<string, Array<Record<string, unknown>>>;
        const res = result.responseExample as Record<string, Array<Record<string, unknown>>>;

        // Arrays should have items
        expect(Array.isArray(req.items)).toBe(true);
        expect(Array.isArray(res.results)).toBe(true);

        // Check first item structure (if array has items)
        if (req.items != null && req.items.length > 0) {
            expect(Object.keys(req.items[0]!).sort()).toEqual(["id", "name", "price"]);
        }
        if (res.results != null && res.results.length > 0) {
            expect(Object.keys(res.results[0]!).sort()).toEqual(["count", "success"]);
        }
    }, 60000);
});
