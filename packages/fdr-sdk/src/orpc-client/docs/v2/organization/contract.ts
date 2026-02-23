import { oc } from "@orpc/contract";
import * as z from "zod";

export const GetOrganizationForUrlInputSchema = z.object({
    url: z.string()
});

export const organizationContract = {
    getOrganizationForUrl: oc
        .route({ method: "POST", path: "/organization-for-url" })
        .input(GetOrganizationForUrlInputSchema)
        .output(z.string())
};
