import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { getBrandAssetsWithUpload } from "@/app/actions/getBrandFetchAssets";
import { withZodValidation } from "@/app/services/dal/zod/middleware";

import { maybeGetCurrentSession } from "../../utils/maybeGetCurrentSession";

const AutoPopulateRequest = z.object({
    identifier: z.string().min(1),
    organizationId: z.string().min(1).optional()
});

const AutoPopulateResponse = z.object({
    updates: z.record(z.unknown())
});

export const POST = withZodValidation(
    AutoPopulateRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof AutoPopulateRequest>) => {
        const maybeSessionData = await maybeGetCurrentSession(req);
        if (maybeSessionData.errorResponse != null) {
            return maybeSessionData.errorResponse;
        }

        const { identifier, organizationId } = validatedBody;
        const result = await getBrandAssetsWithUpload({ identifier, organizationId });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        const validatedResult = AutoPopulateResponse.parse({ updates: result.updates });
        return NextResponse.json(validatedResult);
    }
);
