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
}

export default function OpenAPISpecs({ uploadedSpecs, setUploadedSpecs }: OpenAPISpecsProps) {
    const orgName = useOrgNameFromPathname();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);

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
            // TODO: Show error message to user
        } finally {
            setIsUploading(false);
            // Reset the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-gray-1200">Your API specs (optional)</Label>

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
                className="group cursor-pointer rounded-lg border border-dashed border-gray-500 p-6 text-center transition-colors hover:border-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <div className="flex flex-col items-center gap-2">
                    <UploadCloudIcon className="h-8 w-8 text-gray-900 transition-colors group-hover:text-gray-1100" />
                    <div className="text-sm text-gray-1100">
                        {isUploading ? "Uploading..." : "Drop your spec or click to upload"}
                    </div>
                    <div className="text-xs text-gray-1100">
                        OpenAPI, AsyncAPI, gRPC, OpenRPC, or Fern Definition spec.
                    </div>
                </div>
            </button>

            {/* Uploaded specs list */}
            {uploadedSpecs.length > 0 && (
                <div className="mt-4 space-y-2">
                    {uploadedSpecs.map((spec, index) => (
                        <div key={index} className="flex items-center justify-between gap-3 py-3">
                            <div className="flex items-center gap-3">
                                <CodeXmlIcon className="h-5 w-5 text-gray-900" />
                                <span className="flex-1 text-sm text-gray-1200">{spec.fileName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center rounded-full bg-green-300 py-1 px-2 gap-1">
                                    <div className="h-4 w-4 bg-[#008700] rounded-full flex items-center justify-center">
                                        <CheckIcon className="h-3 w-3 text-white" />
                                    </div>
                                    <span className="text-xs font-light text-primary">Uploaded</span>
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
