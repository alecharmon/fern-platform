import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { doesOrgExist } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { maybeGetCurrentSession } from "../../utils/maybeGetCurrentSession";

const CheckOrgAvailabilitySchema = z.object({
    organizationId: z
        .string()
        .min(1, "organizationId is required")
        .max(100, "organizationId must be 100 characters or fewer")
});

export async function POST(req: NextRequest) {
    const maybeSession = await maybeGetCurrentSession(req);
    if (maybeSession.errorResponse != null) {
        return maybeSession.errorResponse;
    }

    let parsedBody: z.infer<typeof CheckOrgAvailabilitySchema>;
    try {
        const body = await req.json();
        parsedBody = CheckOrgAvailabilitySchema.parse(body);
    } catch (error) {
        return NextResponse.json(
            {
                error: "Invalid request body",
                details: error instanceof Error ? error.message : "Unable to parse request body"
            },
            { status: 400 }
        );
    }

    const exists = await doesOrgExist(Auth0OrgName(parsedBody.organizationId));
    return NextResponse.json({ exists });
}
