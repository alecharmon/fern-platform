import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getPresignedUrlForS3Object } from "@/app/services/s3";

import { maybeGetCurrentSession } from "../../utils/maybeGetCurrentSession";
import { getSignedImageUrlBucketName } from "../bucket";

export declare namespace getSignedImageUrl {
  export type Request = z.infer<typeof GetSignedImageUrlRequest>;
  export type Response = z.infer<typeof GetSignedImageUrlResponse>;
}

const GetSignedImageUrlRequest = z.object({
  key: z.string(),
});

const GetSignedImageUrlResponse = z.object({
  imageUrl: z.string(),
});

export const POST = withZodValidation(
  GetSignedImageUrlRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof GetSignedImageUrlRequest>
  ) => {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
      return maybeSessionData.errorResponse;
    }

    const { key } = validatedBody;

    const url = await getPresignedUrlForS3Object({
      bucketName: getSignedImageUrlBucketName(),
      objectKey: key,
    });
    const validatedResult = GetSignedImageUrlResponse.parse({
      imageUrl: url,
    });
    return NextResponse.json(validatedResult);
  }
);
