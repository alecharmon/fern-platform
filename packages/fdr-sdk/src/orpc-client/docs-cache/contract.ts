import { oc } from "@orpc/contract";
import * as z from "zod";

export const InvalidateCachedDocsInputSchema = z.object({
    url: z.string()
});

export type InvalidateCachedDocsInput = z.infer<typeof InvalidateCachedDocsInputSchema>;

export const docsCacheContract = {
    invalidate: oc
        .route({ method: "POST", path: "/invalidate" })
        .input(InvalidateCachedDocsInputSchema)
        .output(z.void())
};
