"use client";

import CloudArrowUpIcon from "@heroicons/react/24/outline/CloudArrowUpIcon";
import { CodeXmlIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEFAULT_SPECS } from "./constants";

interface OpenAPISpecsProps {
    uploadedFiles: File[];
    setUploadedFiles: (files: File[]) => void;
}

export function OpenAPISpecs({ uploadedFiles, setUploadedFiles }: OpenAPISpecsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const effectiveDefaultSpecs = DEFAULT_SPECS;

    const specWasAdded = useCallback(
        (fileName: string) => {
            return uploadedFiles.some((file) => file.name === fileName);
        },
        [uploadedFiles]
    );

    const handleFileSelect = (file: File | undefined) => {
        if (!file) {
            return;
        }

        setError(null);

        // Check for duplicate
        if (uploadedFiles.some((f) => f.name === file.name && f.size === file.size)) {
            setError("This file has already been added");
            return;
        }

        // Just store the file - will be uploaded during submission
        setUploadedFiles([...uploadedFiles, file]);

        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        handleFileSelect(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        handleFileSelect(file);
    };

    const handleUseDefaultSpec = (specIndex: number) => {
        const spec = effectiveDefaultSpecs[specIndex];
        if (!spec) {
            return;
        }

        // Check if this spec is already added
        const alreadyAdded = uploadedFiles.some((file) => file.name === spec.fileName);
        if (alreadyAdded) {
            return;
        }

        // Create a marker file for the default spec
        // This will be handled specially during upload
        const fileType = spec.fileName.endsWith(".json") ? "application/json" : "application/yaml";
        const defaultMarkerFile = new File([], spec.fileName, { type: fileType });
        setUploadedFiles([...uploadedFiles, defaultMarkerFile]);
    };

    const handleRemoveFile = (fileName: string) => {
        setUploadedFiles(uploadedFiles.filter((file) => file.name !== fileName));
    };

    const customUploadedFiles = uploadedFiles.filter(
        (file) => !DEFAULT_SPECS.some((spec) => spec.fileName === file.name)
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <Label className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">Upload API specs</Label>

                {/* Upload area */}
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".json,.yaml,.yml,.proto"
                    onChange={handleFileChange}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="group cursor-pointer rounded-lg border border-dashed border-border p-6 text-center transition-colors hover:border-gray-700 hover:bg-gray-100"
                >
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <CloudArrowUpIcon className="size-6" /> Drop your spec or click to upload
                        </div>
                        <div className="text-xs">yaml, yml, or json</div>
                    </div>
                </button>
            </div>

            <div className="flex flex-col border-l border-border pl-3 py-1 text-xs gap-2">
                <p className="text-muted-foreground">Starter specs</p>

                {DEFAULT_SPECS.map((spec, index) => (
                    <DisplayDefaultSpec
                        key={index}
                        spec={spec}
                        onAdd={() => handleUseDefaultSpec(index)}
                        added={specWasAdded(spec.fileName)}
                        onRemove={() => handleRemoveFile(spec.fileName)}
                    />
                ))}
            </div>

            {error && <div className="text-xs text-red-600">{error}</div>}

            {/* Uploaded files list */}
            {customUploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                    {customUploadedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
                            <div className="flex items-center gap-3">
                                <CodeXmlIcon className="h-5 w-5 text-gray-900" />
                                <span className="text-gray-1200 flex-1 text-sm">{file.name}</span>
                                {file.size > 0 && (
                                    <span className="text-gray-900 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center gap-1 rounded-full bg-blue-300 px-2 py-1">
                                    <span className="text-primary text-xs font-light">Ready</span>
                                </div>
                                <RemoveFileButton onRemove={() => handleRemoveFile(file.name)} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const DisplayDefaultSpec = ({
    spec,
    onAdd,
    onRemove,
    added
}: {
    spec: { fileName: string; assetUrl: string };
    onAdd: () => void;
    onRemove: () => void;
    added: boolean;
}) => {
    return (
        <div className="flex items-center justify-between gap-2">
            <p className="flex-1 text-sm">{spec.fileName}</p>
            <Button variant="outline" size="xs" onClick={added ? onRemove : onAdd}>
                {added ? "Remove" : "Add"}
            </Button>
        </div>
    );
};

const RemoveFileButton = ({ onRemove }: { onRemove: () => void }) => {
    return (
        <Button variant="ghost" size="iconSm" onClick={onRemove}>
            <XIcon className="size-4" />
        </Button>
    );
};
