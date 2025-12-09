"use client";

import { CheckIcon, CodeXmlIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { uploadOnboardingAsset } from "./api";

interface UploadedSpec {
    fileName: string;
    assetUrl: string;
}

interface OpenAPISpecsProps {
    uploadedSpecs: UploadedSpec[];
    setUploadedSpecs: (specs: UploadedSpec[]) => void;
    defaultSpec?: UploadedSpec;
}

const FALLBACK_DEFAULT_SPEC: UploadedSpec = {
    fileName: "Sample OpenAPI (Petstore).json",
    assetUrl: "https://petstore3.swagger.io/api/v3/openapi.json"
};

export default function OpenAPISpecs({ uploadedSpecs, setUploadedSpecs, defaultSpec }: OpenAPISpecsProps) {
    const orgName = useOrgNameFromPathname();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const effectiveDefaultSpec = defaultSpec ?? FALLBACK_DEFAULT_SPEC;
    const hasDefaultSpec = uploadedSpecs.some((spec) => spec.assetUrl === effectiveDefaultSpec.assetUrl);

    const handleUpload = async (file: File | undefined) => {
        if (!file) {
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const { assetUrl } = await uploadOnboardingAsset(file, orgName);

            // Update the state with the uploaded spec
            setUploadedSpecs([
                ...uploadedSpecs,
                {
                    fileName: file.name,
                    assetUrl
                }
            ]);
        } catch (error) {
            console.error("Error uploading file:", error);
            setError("We couldn't upload that file. Please try again.");
        } finally {
            setIsUploading(false);
            // Reset the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        await handleUpload(file);
    };

    const handleDrop = async (e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (isUploading) {
            return;
        }

        const file = e.dataTransfer.files?.[0];
        await handleUpload(file);
    };

    const handleUseDefaultSpec = () => {
        if (hasDefaultSpec) {
            return;
        }
        setUploadedSpecs([...uploadedSpecs, effectiveDefaultSpec]);
    };

    return (
        <div className="flex flex-col gap-2">
            <Label className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">Your API specs</Label>

            {/* Upload area */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".json,.yaml,.yml,.proto"
                onChange={handleFileChange}
                disabled={isUploading}
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="group cursor-pointer rounded-lg border border-dashed border-gray-500 p-6 text-center transition-colors hover:border-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <div className="flex flex-col items-center gap-2">
                    <UploadCloudIcon className="group-hover:text-gray-1100 h-8 w-8 text-gray-900 transition-colors" />
                    <div className="text-gray-1100 text-sm">
                        {isUploading ? "Uploading..." : "Drop your spec or click to upload"}
                    </div>
                    <div className="text-gray-1100 text-xs">
                        OpenAPI, AsyncAPI, gRPC, OpenRPC, or Fern Definition spec.
                    </div>
                </div>
            </button>

            <div className="flex items-center justify-between text-xs text-gray-1100">
                <span>Don&apos;t have one yet?</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={handleUseDefaultSpec}
                    disabled={isUploading || hasDefaultSpec}
                >
                    {hasDefaultSpec ? "Sample added" : "Use sample OpenAPI spec"}
                </Button>
            </div>

            {error && <div className="text-xs text-red-600">{error}</div>}

            {/* Uploaded specs list */}
            {uploadedSpecs.length > 0 && (
                <div className="mt-4 space-y-2">
                    {uploadedSpecs.map((spec, index) => (
                        <div key={index} className="flex items-center justify-between gap-3 py-3">
                            <div className="flex items-center gap-3">
                                <CodeXmlIcon className="h-5 w-5 text-gray-900" />
                                <span className="text-gray-1200 flex-1 text-sm">{spec.fileName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center gap-1 rounded-full bg-green-300 px-2 py-1">
                                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#008700]">
                                        <CheckIcon className="h-3 w-3 text-white" />
                                    </div>
                                    <span className="text-primary text-xs font-light">Uploaded</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setUploadedSpecs(uploadedSpecs.filter((_, i) => i !== index))}
                                >
                                    <XIcon className="h-4 w-4 text-gray-900" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
