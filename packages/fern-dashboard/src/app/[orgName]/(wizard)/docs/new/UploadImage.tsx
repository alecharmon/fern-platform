"use client";

import { UploadCloudIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { cn } from "@/utils/utils";

import { uploadOnboardingAsset } from "./api";

type ImageSize = "small" | "large";

interface UploadImageProps {
    label: string;
    description: string;
    imageUrl: string | null;
    onImageUpload: (url: string) => void;
    size?: ImageSize;
    accept?: string;
}

export default function UploadImage({
    label,
    description,
    imageUrl,
    onImageUpload,
    size = "large",
    accept = "image/*"
}: UploadImageProps) {
    const orgName = useOrgNameFromPathname();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl);

    // Sync internal state with prop changes
    useEffect(() => {
        setPreviewUrl(imageUrl);
    }, [imageUrl]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        // Create a local preview immediately
        const localPreview = URL.createObjectURL(file);
        setPreviewUrl(localPreview);
        setIsUploading(true);

        try {
            const { assetUrl } = await uploadOnboardingAsset(file, orgName);
            onImageUpload(assetUrl);
            setPreviewUrl(assetUrl);
        } catch (error) {
            console.error("Error uploading image:", error);
            // Revert preview on error
            setPreviewUrl(imageUrl);
            // TODO: Show error message to user
        } finally {
            setIsUploading(false);
            // Clean up the local preview URL
            URL.revokeObjectURL(localPreview);
            // Reset the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const containerClasses = size === "small" ? "h-20 min-w-20 rounded-lg" : "h-36 min-w-36 rounded-xl";

    const iconSize = size === "small" ? "h-6 w-6" : "h-8 w-8";

    return (
        <div className="flex flex-col gap-2">
            <div>
                <Label className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">{label}</Label>
            </div>

            <div className="flex items-center gap-4">
                {/* Image preview */}
                <div
                    className={cn(
                        containerClasses,
                        "flex cursor-pointer items-center justify-center overflow-hidden border border-dashed border-gray-500 bg-transparent p-3 transition-all duration-300 hover:border-gray-700 hover:bg-opacity-100"
                    )}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {previewUrl ? (
                        // biome-ignore lint/performance/noImgElement: false positive
                        <img src={previewUrl} alt={label} className="h-full w-full rounded-lg object-contain" />
                    ) : (
                        <div className="text-gray-900">
                            <UploadCloudIcon className={iconSize} />
                        </div>
                    )}
                </div>

                {/* Upload button and description */}
                <div className="flex flex-col gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept={accept}
                        onChange={handleFileChange}
                        disabled={isUploading}
                    />
                    <Button
                        variant="outline"
                        className="flex w-fit items-center gap-1 text-xs"
                        size="default"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        <UploadCloudIcon className="mr-2 h-4 w-4" />
                        <span>{isUploading ? "Uploading..." : "Upload"}</span>
                    </Button>
                    <p className="text-gray-1000 text-xs">{description}</p>
                </div>
            </div>
        </div>
    );
}
