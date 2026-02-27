"use client";

import { CircleCheckIcon, CloudUpload, CodeXmlIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { PostmanLogo } from "@/components/auth/PostmanLogo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_SPECS } from "./constants";

interface OpenAPISpecsProps {
    uploadedFiles: File[];
    setUploadedFiles: (files: File[]) => void;
    validationError?: string;
    isFromPostman?: boolean;
    onSpecAdded?: (source: "custom" | "sample", fileName: string) => void;
    onSpecRemoved?: (source: "custom" | "sample", fileName: string) => void;
}

export function OpenAPISpecs({
    uploadedFiles,
    setUploadedFiles,
    validationError,
    isFromPostman,
    onSpecAdded,
    onSpecRemoved
}: OpenAPISpecsProps) {
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
        onSpecAdded?.("custom", file.name);

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
        onSpecAdded?.("sample", spec.fileName);
    };

    const handleRemoveFile = (fileName: string) => {
        const defaultFileNames: Set<string> = new Set(DEFAULT_SPECS.map((spec) => spec.fileName));
        const source = defaultFileNames.has(fileName) ? "sample" : "custom";
        setUploadedFiles(uploadedFiles.filter((file) => file.name !== fileName));
        onSpecRemoved?.(source, fileName);
    };

    const customUploadedFiles = uploadedFiles.filter(
        (file) => !DEFAULT_SPECS.some((spec) => spec.fileName === file.name)
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
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
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add("border-gray-700", "bg-gray-100");
                    }}
                    onDragLeave={(e) => {
                        e.currentTarget.classList.remove("border-gray-700", "bg-gray-100");
                    }}
                    onDrop={(e) => {
                        e.currentTarget.classList.remove("border-gray-700", "bg-gray-100");
                        handleDrop(e);
                    }}
                    className="group cursor-pointer rounded-lg border border-dashed border-border p-6 text-center transition-colors hover:border-gray-700 hover:bg-gray-100"
                >
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <CloudUpload className="size-6" /> Drop or click to upload
                        </div>
                        <div className="text-xs">yaml, yml, or json</div>
                    </div>
                </button>
                {(validationError || error) && (
                    <p className="text-xs text-red-600 dark:text-red-400">{validationError || error}</p>
                )}
            </div>

            {/* Uploaded files list */}
            {customUploadedFiles.length > 0 && (
                <div className="space-y-2">
                    {customUploadedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
                            <div className="flex items-center gap-3">
                                {isFromPostman ? (
                                    <PostmanLogo className="h-5 w-5 text-[#FF6C37]" />
                                ) : (
                                    <CodeXmlIcon className="h-5 w-5 text-gray-900" />
                                )}
                                <span className="text-gray-1200 flex-1 text-sm">{file.name}</span>
                                {file.size > 0 && (
                                    <span className="text-gray-900 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <RemoveFileButton onRemove={() => handleRemoveFile(file.name)} />
                                <Badge variant="success">
                                    <CircleCheckIcon className="size-3" /> Uploaded
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isFromPostman && (
                <div className="flex flex-col border-l border-border pl-3 py-1 text-xs gap-2">
                    <p className="text-muted-foreground">Don't have a spec? Add an example.</p>

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
        <div className="flex items-center justify-between gap-1">
            <p className="flex-1 text-sm">{spec.fileName}</p>
            {added ? (
                <>
                    <RemoveFileButton onRemove={onRemove} />
                    <Badge variant="success">
                        <CircleCheckIcon className="size-3" /> Added
                    </Badge>
                </>
            ) : (
                <Button variant="outline" size="xs" onClick={onAdd}>
                    Add
                </Button>
            )}
        </div>
    );
};

const RemoveFileButton = ({ onRemove }: { onRemove: () => void }) => {
    return (
        <Button variant="ghost" size="iconSm" onClick={onRemove} className="size-6">
            <XIcon className="size-3" />
        </Button>
    );
};
