"use client";

import * as React from "react";

import CloudArrowUpIcon from "@heroicons/react/24/outline/CloudArrowUpIcon";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

import "@/components/editor/tiptap-node/media-upload-node/media-upload-node.scss";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tab, TabGroup } from "@/docs/mdx/components/tabs";

import { createCustomElementNode } from "../../extension-custom-element/create-custom-element-node";

export interface FileItem {
    /**
     * Unique identifier for the file item
     */
    id: string;
    /**
     * The actual File object being uploaded
     */
    file: File;
    /**
     * Current upload progress as a percentage (0-100)
     */
    progress: number;
    /**
     * Current status of the file upload process
     * @default "uploading"
     */
    status: "uploading" | "success" | "error";

    /**
     * URL to the uploaded file, available after successful upload
     * @optional
     */
    url?: string;
    /**
     * Controller that can be used to abort the upload process
     * @optional
     */
    abortController?: AbortController;
}

export interface UploadOptions {
    /**
     * Maximum allowed file size in bytes
     */
    maxSize: number;
    /**
     * Maximum number of files that can be uploaded
     */
    limit: number;
    /**
     * String specifying acceptable file types (MIME types or extensions)
     * @example ".jpg,.png,image/jpeg" or "image/*"
     */
    accept: string;
    /**
     * Function that handles the actual file upload process
     * @param {File} file - The file to be uploaded
     * @param {Function} onProgress - Callback function to report upload progress
     * @param {AbortSignal} signal - Signal that can be used to abort the upload
     * @returns {Promise<string>} Promise resolving to the URL of the uploaded file
     */
    upload: (file: File, onProgress: (event: { progress: number }) => void, signal: AbortSignal) => Promise<string>;
    /**
     * Callback triggered when a file is uploaded successfully
     * @param {string} url - URL of the successfully uploaded file
     * @optional
     */
    onSuccess?: (url: string) => void;
    /**
     * Callback triggered when an error occurs during upload
     * @param {Error} error - The error that occurred
     * @optional
     */
    onError?: (error: Error) => void;
}

/**
 * Custom hook for managing multiple file uploads with progress tracking and cancellation
 */
function useFileUpload(options: UploadOptions) {
    const [fileItems, setFileItems] = React.useState<FileItem[]>([]);

    const uploadFile = async (file: File): Promise<string | null> => {
        if (file.size > options.maxSize) {
            const error = new Error(`File size exceeds maximum allowed (${options.maxSize / 1024 / 1024}MB)`);
            options.onError?.(error);
            return null;
        }

        const abortController = new AbortController();
        const fileId = crypto.randomUUID();

        const newFileItem: FileItem = {
            id: fileId,
            file,
            progress: 0,
            status: "uploading",
            abortController
        };

        setFileItems((prev) => [...prev, newFileItem]);

        try {
            if (!options.upload) {
                throw new Error("Upload function is not defined");
            }

            const url = await options.upload(
                file,
                (event: { progress: number }) => {
                    setFileItems((prev) =>
                        prev.map((item) => (item.id === fileId ? { ...item, progress: event.progress } : item))
                    );
                },
                abortController.signal
            );

            if (!url) throw new Error("Upload failed: No URL returned");

            if (!abortController.signal.aborted) {
                setFileItems((prev) =>
                    prev.map((item) => (item.id === fileId ? { ...item, status: "success", url, progress: 100 } : item))
                );
                options.onSuccess?.(url);
                return url;
            }

            return null;
        } catch (error) {
            if (!abortController.signal.aborted) {
                setFileItems((prev) =>
                    prev.map((item) => (item.id === fileId ? { ...item, status: "error", progress: 0 } : item))
                );
                options.onError?.(error instanceof Error ? error : new Error("Upload failed"));
            }
            return null;
        }
    };

    const uploadFiles = async (files: File[]): Promise<string[]> => {
        if (!files || files.length === 0) {
            options.onError?.(new Error("No files to upload"));
            return [];
        }

        if (options.limit && files.length > options.limit) {
            options.onError?.(new Error(`Maximum ${options.limit} file${options.limit === 1 ? "" : "s"} allowed`));
            return [];
        }

        // Upload all files concurrently
        const uploadPromises = files.map((file) => uploadFile(file));
        const results = await Promise.all(uploadPromises);

        // Filter out null results (failed uploads)
        return results.filter((url): url is string => url != null);
    };

    const removeFileItem = (fileId: string) => {
        setFileItems((prev) => {
            const fileToRemove = prev.find((item) => item.id === fileId);
            if (fileToRemove?.abortController) {
                fileToRemove.abortController.abort();
            }
            if (fileToRemove?.url) {
                URL.revokeObjectURL(fileToRemove.url);
            }
            return prev.filter((item) => item.id !== fileId);
        });
    };

    const clearAllFiles = () => {
        fileItems.forEach((item) => {
            if (item.abortController) {
                item.abortController.abort();
            }
            if (item.url) {
                URL.revokeObjectURL(item.url);
            }
        });
        setFileItems([]);
    };

    return {
        fileItems,
        uploadFiles,
        removeFileItem,
        clearAllFiles
    };
}

interface MediaUploadDragAreaProps {
    /**
     * Callback function triggered when files are dropped or selected
     * @param {File[]} files - Array of File objects that were dropped or selected
     */
    onFile: (files: File[]) => void;
    /**
     * Optional child elements to render inside the drag area
     * @optional
     * @default undefined
     */
    children?: React.ReactNode;
}

/**
 * A component that creates a drag-and-drop area for media uploads (images and videos)
 */
const MediaUploadDragArea: React.FC<MediaUploadDragAreaProps> = ({ onFile, children }) => {
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [isDragActive, setIsDragActive] = React.useState(false);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragActive(false);
            setIsDragOver(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onFile(files);
        }
    };

    return (
        <div
            className={`tiptap-image-upload-drag-area ${isDragActive ? "drag-active" : ""} ${isDragOver ? "drag-over" : ""}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {children}
        </div>
    );
};

interface MediaUploadPreviewProps {
    /**
     * The file item to preview
     */
    fileItem: FileItem;
}

/**
 * Component that displays a preview of an uploading media file with progress
 */
const MediaUploadPreview: React.FC<MediaUploadPreviewProps> = ({ fileItem }) => {
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    return (
        <div className="tiptap-image-upload-preview">
            {fileItem.status === "uploading" && (
                <div className="tiptap-image-upload-progress" style={{ width: `${fileItem.progress}%` }} />
            )}

            <div className="tiptap-image-upload-preview-content">
                <div className="tiptap-image-upload-file-info">
                    <div className="tiptap-image-upload-file-icon">
                        <CloudArrowUpIcon className="size-8" />
                    </div>
                    <div className="tiptap-image-upload-details">
                        <span className="tiptap-image-upload-text">{fileItem.file.name}</span>
                        <span className="tiptap-image-upload-subtext">{formatFileSize(fileItem.file.size)}</span>
                    </div>
                </div>
                <div className="tiptap-image-upload-actions">
                    {fileItem.status === "uploading" && (
                        <span className="tiptap-image-upload-progress-text">{fileItem.progress}%</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export const MediaUploadNode: React.FC<NodeViewProps> = (props) => {
    const { accept, limit, maxSize } = props.node.attrs;
    const inputRef = React.useRef<HTMLInputElement>(null);
    const extension = props.extension;
    const [imageUrl, setImageUrl] = React.useState("");

    const uploadOptions: UploadOptions = {
        maxSize,
        limit,
        accept,
        upload: extension.options.upload,
        onSuccess: extension.options.onSuccess,
        onError: extension.options.onError
    };

    const { fileItems, uploadFiles } = useFileUpload(uploadOptions);

    const isVideo = (file: File): boolean => {
        return file.type.startsWith("video/");
    };

    const handleUpload = async (files: File[]) => {
        const urls = await uploadFiles(files);

        if (urls.length > 0) {
            const pos = props.getPos();

            if (pos != null) {
                const mediaNodes = urls.map((url, index) => {
                    const file = files[index];
                    const filename = file?.name.replace(/\.[^/.]+$/, "") || "unknown";

                    if (file && isVideo(file)) {
                        return createCustomElementNode(`<video src="${url}" title="${filename}" controls></video>`);
                    } else {
                        return createCustomElementNode(`<img src="${url}" alt="${filename}" title="${filename}" />`);
                    }
                });

                props.editor
                    .chain()
                    .focus()
                    .deleteRange({ from: pos, to: pos + props.node.nodeSize })
                    .insertContentAt(pos, mediaNodes)
                    .run();
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) {
            extension.options.onError?.(new Error("No file selected"));
            return;
        }
        void handleUpload(Array.from(files));
    };

    const isVideoUrl = (url: string): boolean => {
        const videoExtensions = [".mp4", ".webm", ".ogg", ".avi", ".mov", ".wmv", ".flv", ".mkv"];
        const lowerUrl = url.toLowerCase();
        return videoExtensions.some((ext) => lowerUrl.includes(ext));
    };

    // Handles URL submission via input field in URL tab
    const handleUrlSubmit = () => {
        const pos = props.getPos();
        if (imageUrl.trim() == null) {
            extension.options.onError?.(new Error("No media URL provided"));
            return;
        }
        if (pos == null) {
            extension.options.onError?.(new Error("No position found"));
            return;
        }

        const newMediaNode = isVideoUrl(imageUrl)
            ? createCustomElementNode(`<video src="${imageUrl}" controls></video>`)
            : createCustomElementNode(`<img src="${imageUrl}" />`);

        props.editor
            .chain()
            .focus()
            .deleteRange({ from: pos, to: pos + props.node.nodeSize })
            .insertContentAt(pos, newMediaNode)
            .run();
    };

    const hasFiles = fileItems.length > 0;

    return (
        <NodeViewWrapper className="tiptap-image-upload" tabIndex={0}>
            {!hasFiles && (
                <Popover>
                    <PopoverTrigger className="w-full">
                        <MediaUploadDragArea onFile={(files) => void handleUpload(files)}>
                            <div className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-500 p-3">
                                <div className="tiptap-image-upload-text flex items-center gap-2">
                                    <CloudArrowUpIcon className="size-8" />
                                    <p>Add media</p>
                                </div>
                            </div>
                        </MediaUploadDragArea>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px]">
                        <TabGroup>
                            <Tab title="Upload">
                                <Button asChild className="-mt-6">
                                    <button className="relative w-full">
                                        Upload file
                                        <input
                                            type="file"
                                            accept="image/*,video/*"
                                            onChange={(e) => {
                                                const files = e.target.files;
                                                if (!files || files.length === 0) {
                                                    extension.options.onError?.(new Error("No file selected"));
                                                    return;
                                                }
                                                void handleUpload(Array.from(files));
                                            }}
                                            className="absolute inset-0 cursor-pointer opacity-0"
                                        />
                                    </button>
                                </Button>
                            </Tab>
                            <Tab title="URL">
                                <div className="-mt-3 flex flex-col gap-2">
                                    <Input
                                        type="url"
                                        placeholder="Paste image or video URL..."
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        className="w-full"
                                    />
                                    <Button onClick={handleUrlSubmit} disabled={!imageUrl.trim()} className="w-full">
                                        Embed media
                                    </Button>
                                </div>
                            </Tab>
                        </TabGroup>
                    </PopoverContent>
                </Popover>
            )}

            {hasFiles && (
                <div className="tiptap-image-upload-previews">
                    {fileItems.map((fileItem) => (
                        <MediaUploadPreview key={fileItem.id} fileItem={fileItem} />
                    ))}
                </div>
            )}

            <input
                ref={inputRef}
                name="file"
                accept={accept}
                type="file"
                multiple={limit > 1}
                onChange={handleChange}
                onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
            />
        </NodeViewWrapper>
    );
};
