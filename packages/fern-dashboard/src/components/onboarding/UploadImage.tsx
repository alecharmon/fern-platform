"use client";

import { UploadCloudIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils/utils";

type ImageSize = "small" | "large";

interface UploadImageProps {
    label: string;
    description: string;
    imageUrl: string | null;
    onFileSelect: (file: File) => void;
    size?: ImageSize;
    accept?: string;
    defaultImageUrl?: string | null;
}

export function UploadImage({
    label,
    description,
    imageUrl,
    onFileSelect,
    defaultImageUrl = "https://raw.githubusercontent.com/fern-api/docs-starter/main/fern/docs/assets/logo.svg",
    size = "large",
    accept = "image/*"
}: UploadImageProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

    // If parent clears imageUrl (explicit null), ignore local preview and fall back to default.
    const effectivePreview =
        imageUrl === null ? (defaultImageUrl ?? null) : (imageUrl ?? localPreviewUrl ?? defaultImageUrl ?? null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        // Create a local preview immediately
        const localPreview = URL.createObjectURL(file);
        setLocalPreviewUrl(localPreview);

        // Notify parent - file will be uploaded during submission
        onFileSelect(file);

        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
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
                    {effectivePreview ? (
                        // biome-ignore lint/performance/noImgElement: false positive
                        <img src={effectivePreview} alt={label} className="h-full w-full rounded-lg object-contain" />
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
                    />
                    <Button
                        variant="outline"
                        className="flex w-fit items-center gap-1 text-xs"
                        size="default"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadCloudIcon className="mr-2 h-4 w-4" />
                        <span>Upload</span>
                    </Button>
                    <p className="text-gray-1000 text-xs">{description}</p>
                </div>
            </div>
        </div>
    );
}
