import { z } from "zod";

const DurationSchema = z.object({
    days: z.number().optional(),
    hours: z.number().optional()
});

const ActivityLogEntrySchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("ask_fern"),
        metadata: z.object({
            user_id: z.string().optional(),
            question: z.string(),
            response_tokens: z.number()
        })
    }),
    z.object({
        type: z.literal("fern_writer"),
        metadata: z.object({
            user_id: z.string().optional(),
            github_repo: z.string(),
            channel: z.string().optional(),
            message_text: z.string().optional(),
            response_tokens: z.number()
        })
    })
]);

const ActivityLogTypeSchema = z.enum(["ask_fern", "fern_writer"]);

export const InsertActivitySchema = z.object({
    org_id: z.string().min(1),
    site: z.string().min(1),
    entry: ActivityLogEntrySchema,
    ttl: DurationSchema.optional()
});

export const InsertCreditsSchema = z.object({
    org_id: z.string().min(1),
    site: z.string().min(1),
    type: ActivityLogTypeSchema,
    credits_used: z.number().int(),
    event_id: z.string().min(1)
});

export const InsertWithCreditsSchema = z.object({
    org_id: z.string().min(1),
    site: z.string().min(1),
    entry: ActivityLogEntrySchema,
    ttl: DurationSchema.optional()
});

export const SumCreditsSchema = z.object({
    org_id: z.string().min(1),
    since: z.string().min(1),
    until: z.string().min(1),
    site: z.string().optional(),
    type: ActivityLogTypeSchema.optional()
});

export const CreditsCheckQuerySchema = z.object({
    org_id: z.string().min(1)
});
