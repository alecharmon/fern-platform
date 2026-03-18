import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import {
    getAuth0ManagementClient,
    getOrgIdFromName,
    invalidateCachesAfterUpdatingOrgMetadata
} from "@/app/services/auth0/management";
import { type Auth0Organization, Auth0OrgName } from "@/app/services/auth0/types";
import { convertToAuth0Organization } from "@/app/services/auth0/utils";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getS3Client } from "@/app/services/s3";
import { isSvgMimeType, sanitizeSvg } from "@/app/services/svg-sanitizer";

export declare namespace uploadOrgLogo {
    export interface Response {
        organization: Auth0Organization;
        imageUrl: string;
    }
}

function getOrgLogoBucketName() {
    if (process.env.VE_IMAGES_PUBLIC_S3_BUCKET_NAME == null) {
        throw new Error("VE_IMAGES_PUBLIC_S3_BUCKET_NAME is not defined in the environment");
    }
    return process.env.VE_IMAGES_PUBLIC_S3_BUCKET_NAME;
}

function cleanFileName(fileName: string): string {
    return fileName.replaceAll(" ", "_").replaceAll("/", "-");
}

export async function POST(request: Request): Promise<NextResponse<uploadOrgLogo.Response>> {
    const session = await getCurrentSession();
    if (session == null) {
        return NextResponse.json({ error: "Unauthorized" } as any, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const organizationName = formData.get("organizationName") as string;

        if (!file) {
            return NextResponse.json({ error: "File is required" } as any, { status: 400 });
        }

        if (!organizationName) {
            return NextResponse.json({ error: "Organization name is required" } as any, { status: 400 });
        }

        // Validate declared MIME type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "File must be an image" } as any, { status: 400 });
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({ error: "File size must be less than 5MB" } as any, { status: 400 });
        }

        let buffer: Buffer = Buffer.from(await file.arrayBuffer());

        // Validate file content magic bytes match the declared MIME type.
        // SVGs are XML-based and don't have magic bytes, so they are validated
        // separately via sanitization below.
        const isSvg = isSvgMimeType(file.type) || file.name.toLowerCase().endsWith(".svg");
        if (!isSvg) {
            const { fileTypeFromBuffer } = await import("file-type");
            const detectedType = await fileTypeFromBuffer(buffer);
            if (detectedType == null || !detectedType.mime.startsWith("image/")) {
                return NextResponse.json({ error: "File content does not match a valid image type" } as any, {
                    status: 400
                });
            }
        }

        const orgName = Auth0OrgName(organizationName);

        await assertUserHasOrganizationAccess(session.accessToken, orgName);

        // Upload to S3
        const timestamp = new Date().toISOString();
        const key = `org-logos/${organizationName}/${timestamp}/${cleanFileName(file.name)}`;

        // Sanitize SVG files to prevent Stored XSS attacks by stripping
        // <script> tags, on* event handlers, and other dangerous content
        if (isSvg) {
            buffer = await sanitizeSvg(buffer);
        }

        await getS3Client().send(
            new PutObjectCommand({
                Bucket: getOrgLogoBucketName(),
                Key: key,
                Body: buffer,
                ContentType: file.type,
                // Force SVG files to be downloaded instead of rendered in the browser,
                // preventing any scripts from executing even if sanitization is bypassed
                ContentDisposition: isSvg ? "attachment" : undefined,
                // Set CSP metadata on SVG files to restrict script execution as an
                // additional defense layer. CloudFront/S3 can be configured to serve
                // this metadata as a response header.
                Metadata: isSvg
                    ? {
                          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:;"
                      }
                    : undefined
                // Note: No ACL needed - bucket is configured with public read policy
            })
        );

        const imageUrl = `https://files.buildwithfern.com/${key}`;

        // Update Auth0 organization branding
        const auth0 = getAuth0ManagementClient();
        const orgId = await getOrgIdFromName(orgName);

        const { data: updatedOrg } = await auth0.organizations.update(
            { id: orgId },
            {
                branding: {
                    logo_url: imageUrl
                }
            }
        );

        // Invalidate the organization cache
        await invalidateCachesAfterUpdatingOrgMetadata(orgName);

        return NextResponse.json({
            organization: convertToAuth0Organization(updatedOrg),
            imageUrl
        });
    } catch (error) {
        console.error("Error uploading organization logo:", error);
        return NextResponse.json({ error: "Failed to upload logo" } as any, { status: 500 });
    }
}
