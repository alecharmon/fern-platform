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

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "File must be an image" } as any, { status: 400 });
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({ error: "File size must be less than 5MB" } as any, { status: 400 });
        }

        const orgName = Auth0OrgName(organizationName);

        await assertUserHasOrganizationAccess(session.accessToken, orgName);

        // Upload to S3
        const timestamp = new Date().toISOString();
        const key = `org-logos/${organizationName}/${timestamp}/${cleanFileName(file.name)}`;

        const buffer = Buffer.from(await file.arrayBuffer());

        await getS3Client().send(
            new PutObjectCommand({
                Bucket: getOrgLogoBucketName(),
                Key: key,
                Body: buffer,
                ContentType: file.type
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
