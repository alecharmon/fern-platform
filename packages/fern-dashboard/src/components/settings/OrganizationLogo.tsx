"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Auth0Organization } from "@/app/services/auth0/types";
import { useInvalidateOrganizations } from "@/state/useOrganizations";
import { Button } from "../ui/button";

export declare namespace OrganizationLogo {
    export interface Props {
        organization: Auth0Organization;
    }
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];

export function OrganizationLogo({ organization }: OrganizationLogo.Props) {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const invalidateOrganizations = useInvalidateOrganizations();

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        // Validate file type
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            setError("Please upload a PNG, JPG, or SVG image");
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            setError(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
            return;
        }

        setIsUploading(true);
        setError(null);
        setSuccess(false);
        setUploadProgress(0);

        try {
            // Upload file via server (which handles S3 upload and Auth0 update)
            const formData = new FormData();
            formData.append("file", file);
            formData.append("organizationName", organization.name);

            setUploadProgress(30);

            const uploadResponse = await fetch("/api/organization/logo/upload", {
                method: "POST",
                body: formData
            });

            setUploadProgress(70);

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || "Failed to upload logo");
            }

            setUploadProgress(100);
            setSuccess(true);

            // Invalidate the organizations cache to refetch with the new logo
            invalidateOrganizations();

            // Clear success message and reset file input after 3 seconds
            setTimeout(() => {
                setSuccess(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="border-border mx-auto flex w-full max-w-[750px] flex-col rounded-xl border bg-gray-100 p-4">
            <div className="flex flex-col gap-1">
                <div className="font-bold">Organization Logo</div>
                <div className="text-gray-900">Update the logo displayed for your organization</div>
            </div>

            <div className="mt-4 flex flex-col gap-4">
                <div className="flex items-center justify-center rounded-lg border-2 border-gray-300 bg-card p-8">
                    {organization.branding?.logo_url ? (
                        <div className="flex size-32 items-center justify-center overflow-hidden rounded">
                            <Image
                                src={organization.branding.logo_url}
                                alt={`${organization.display_name} logo`}
                                width={128}
                                height={128}
                                className="size-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="flex size-32 items-center justify-center rounded bg-gray-100 text-4xl font-bold text-gray-400">
                            {organization.display_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isUploading}
                />

                {isUploading && (
                    <div className="flex flex-col gap-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p className="text-center text-sm text-muted-foreground">Uploading...</p>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <p className="text-sm text-green-800">Logo updated successfully!</p>
                    </div>
                )}

                <div className="text-xs text-gray-900">Upload a PNG, JPG, or SVG image. Maximum file size: 5MB.</div>
            </div>

            <div className="mt-5 flex justify-center md:justify-end">
                <Button onClick={handleButtonClick} disabled={isUploading}>
                    {isUploading ? "Uploading..." : "Upload new picture"}
                </Button>
            </div>
        </div>
    );
}
