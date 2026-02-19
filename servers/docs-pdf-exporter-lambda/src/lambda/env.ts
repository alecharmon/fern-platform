import { z } from "zod";

const EnvSchema = z.object({
    // Used to authenticate browser requests to protected docs sites.
    PDF_EXPORT_FERN_TOKEN: z.string().min(1, "PDF_EXPORT_FERN_TOKEN is required"),
    // Required for service-to-service JWT auth back to FDR.
    PDF_EXPORT_JWT_SECRET_KEY: z.string().min(1, "PDF_EXPORT_JWT_SECRET_KEY is required")
});

export type ExporterLambdaEnv = z.infer<typeof EnvSchema>;

export const env = EnvSchema.parse(process.env);
