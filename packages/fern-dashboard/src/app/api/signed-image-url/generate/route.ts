import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withZodValidation } from "@/app/services/dal/zod/middleware";

import { maybeGetCurrentSession } from "../../utils/maybeGetCurrentSession";
import handler from "./handler";

export declare namespace generateSignedUploadUrl {
  export type Request = z.infer<typeof GenerateSignedUploadUrlRequest>;
  export type Response = z.infer<typeof GenerateSignedUploadUrlResponse>;
}

const GenerateSignedUploadUrlRequest = z.object({
  fileName: z.string(),
  contentType: z.string(),
  docsUrl: z.string(),
  slug: z.string(),
});

const GenerateSignedUploadUrlResponse = z.object({
  uploadUrl: z.string(),
  imageUrl: z.string(),
  key: z.string(),
});

export const POST = withZodValidation(
  GenerateSignedUploadUrlRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof GenerateSignedUploadUrlRequest>
  ) => {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
      return maybeSessionData.errorResponse;
    }

    const { fileName, contentType, docsUrl, slug } = validatedBody;

    const result = await handler({
      fileName,
      contentType,
      docsUrl,
      slug,
    });
    const validatedResult = GenerateSignedUploadUrlResponse.parse(result.data);
    return NextResponse.json(validatedResult);
  }
);
