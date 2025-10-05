import { type NextRequest, NextResponse } from "next/server";

import type { z } from "zod";

/**
 * Higher-order function that adds Zod request body validation to any handler
 *
 * @param schema - Zod schema to validate the request body against
 * @param handler - Handler that receives the validated body as a third parameter
 * @returns A new handler with body validation built-in
 *
 * @examplee
 * const MySchema = z.object({ name: z.string(), age: z.number() });
 *
 * export const POST = withZodValidation(
 *   MySchema,
 *   async (req, validatedBody) => {
 *     // validatedBody is fully typed and validated
 *     return NextResponse.json({ received: validatedBody });
 *   }
 * );
 */
export interface ValidatedRequest<TSchema extends z.ZodSchema> extends NextRequest {
    validatedBody: z.infer<TSchema>;
}

export function withZodValidation<TSchema extends z.ZodSchema>(
    schema: TSchema,
    handler: (req: ValidatedRequest<TSchema>, parsedBody: z.infer<TSchema>) => Promise<NextResponse>
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        try {
            // Parse request body
            const rawBody = await req.json();

            // Validate against schema
            const validationResult = schema.safeParse(rawBody);

            if (!validationResult.success) {
                return NextResponse.json(
                    {
                        error: "Invalid request body",
                        details: validationResult.error.issues
                    },
                    { status: 400 }
                );
            }

            // Create amended request with validated body
            const validatedReq = req as ValidatedRequest<TSchema>;
            validatedReq.validatedBody = validationResult.data;

            // Call handler with amended request and parsed body
            return await handler(validatedReq, validationResult.data);
        } catch (error) {
            // Handle JSON parsing errors
            if (error instanceof SyntaxError) {
                return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
            }

            // Re-throw unexpected errors
            throw error;
        }
    };
}
