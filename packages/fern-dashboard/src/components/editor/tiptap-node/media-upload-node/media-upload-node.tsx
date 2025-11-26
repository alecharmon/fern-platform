"use client";

import CloudArrowUpIcon from "@heroicons/react/24/outline/CloudArrowUpIcon";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import * as React from "react";

import "@/components/editor/tiptap-node/media-upload-node/media-upload-node.scss";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

            if (!url) {
                throw new Error("Upload failed: No URL returned");
            }

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
        if (bytes === 0) {
            return "0 Bytes";
        }
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
    const { mediaType = "auto", accept, limit, maxSize } = props.node.attrs;
    const inputRef = React.useRef<HTMLInputElement>(null);
    const extension = props.extension;
    const [imageUrl, setImageUrl] = React.useState("");

    const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".avi", ".mov", ".wmv", ".flv", ".mkv"];
    const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tiff"];

    const computedAccept =
        mediaType === "image" ? "image/*" : mediaType === "video" ? "video/*" : accept || "image/*,video/*";

    const uploadOptions: UploadOptions = {
        maxSize,
        limit,
        accept: computedAccept,
        upload: extension.options.upload,
        onSuccess: extension.options.onSuccess,
        onError: extension.options.onError
    };

    const { fileItems, uploadFiles } = useFileUpload(uploadOptions);

    const isImage = (file: File): boolean => {
        if (file.type?.startsWith("image/")) {
            return true;
        }
        const fileName = (file.name || "").toLowerCase();
        return IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    };

    const isVideo = (file: File): boolean => {
        if (file.type?.startsWith("video/")) {
            return true;
        }
        const fileName = (file.name || "").toLowerCase();
        return VIDEO_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    };

    const handleUpload = async (files: File[]) => {
        if (mediaType === "image") {
            const nonImageFiles = files.filter((file) => !isImage(file));
            if (nonImageFiles.length > 0) {
                extension.options.onError?.(new Error("Expected an image file"));
                return;
            }
        } else if (mediaType === "video") {
            const nonVideoFiles = files.filter((file) => !isVideo(file));
            if (nonVideoFiles.length > 0) {
                extension.options.onError?.(new Error("Expected a video file"));
                return;
            }
        }

        const urls = await uploadFiles(files);

        if (urls.length > 0) {
            const pos = props.getPos();

            if (pos != null) {
                const mediaNodes = urls.map((url, index) => {
                    const file = files[index];
                    const filename = file?.name.replace(/\.[^/.]+$/, "") || "unknown";

                    if (mediaType === "video" || (mediaType === "auto" && file && isVideo(file))) {
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

    const isImageUrl = (url: string): boolean => {
        try {
            const pathname = new URL(url).pathname.toLowerCase();
            return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
        } catch {
            const lowerUrl = url.toLowerCase();
            return IMAGE_EXTENSIONS.some((ext) => lowerUrl.endsWith(ext));
        }
    };

    const isDirectVideoFileUrl = (url: string): boolean => {
        try {
            const pathname = new URL(url).pathname.toLowerCase();
            return VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext));
        } catch {
            const lowerUrl = url.toLowerCase();
            return VIDEO_EXTENSIONS.some((ext) => lowerUrl.endsWith(ext));
        }
    };

    const getEmbedInfo = (url: string): string | null => {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const pathname = urlObj.pathname;

            if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
                if (hostname.includes("youtu.be")) {
                    const videoId = pathname.split("/")[1]?.split("?")[0];
                    if (videoId) {
                        return `https://www.youtube.com/embed/${videoId}`;
                    }
                } else if (pathname.includes("/watch")) {
                    const videoId = urlObj.searchParams.get("v");
                    if (videoId) {
                        return `https://www.youtube.com/embed/${videoId}`;
                    }
                } else if (pathname.includes("/shorts/")) {
                    const videoId = pathname.split("/shorts/")[1]?.split("?")[0];
                    if (videoId) {
                        return `https://www.youtube.com/embed/${videoId}`;
                    }
                } else if (pathname.includes("/embed/")) {
                    return url;
                }
            }

            if (hostname.includes("vimeo.com")) {
                if (hostname.includes("player.vimeo.com") && pathname.includes("/video/")) {
                    return url;
                }
                const videoId = pathname.split("/").filter(Boolean)[0];
                if (videoId && /^\d+$/.test(videoId)) {
                    return `https://player.vimeo.com/video/${videoId}`;
                }
            }

            if (hostname.includes("loom.com")) {
                if (pathname.includes("/embed/")) {
                    return url;
                }
                if (hostname.includes("share.loom.com") && pathname.includes("/share/")) {
                    const videoId = pathname.split("/share/")[1]?.split("?")[0];
                    if (videoId) {
                        return `https://www.loom.com/embed/${videoId}`;
                    }
                }
            }

            return null;
        } catch {
            return null;
        }
    };

    const isKnownVideoEmbed = (url: string): boolean => {
        return getEmbedInfo(url) !== null;
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

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(imageUrl);
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
                extension.options.onError?.(new Error("Invalid URL protocol"));
                return;
            }
        } catch {
            extension.options.onError?.(new Error("Invalid URL"));
            return;
        }

        let newMediaNode;

        if (mediaType === "image") {
            if (!isImageUrl(imageUrl)) {
                extension.options.onError?.(new Error("Expected an image URL"));
                return;
            }
            newMediaNode = createCustomElementNode(`<img src="${imageUrl}" />`);
        } else if (mediaType === "video") {
            if (isDirectVideoFileUrl(imageUrl)) {
                newMediaNode = createCustomElementNode(`<video src="${imageUrl}" controls></video>`);
            } else if (isKnownVideoEmbed(imageUrl)) {
                const embedUrl = getEmbedInfo(imageUrl) || imageUrl;
                newMediaNode = createCustomElementNode(
                    `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen title="Video" width="100%" height="315"></iframe>`
                );
            } else {
                newMediaNode = createCustomElementNode(
                    `<iframe src="${imageUrl}" sandbox="allow-same-origin allow-scripts allow-presentation" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" allowfullscreen title="Media" width="100%" height="315"></iframe>`
                );
            }
        } else {
            if (isDirectVideoFileUrl(imageUrl)) {
                newMediaNode = createCustomElementNode(`<video src="${imageUrl}" controls></video>`);
            } else if (isKnownVideoEmbed(imageUrl)) {
                const embedUrl = getEmbedInfo(imageUrl) || imageUrl;
                newMediaNode = createCustomElementNode(
                    `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen title="Video" width="100%" height="315"></iframe>`
                );
            } else if (isImageUrl(imageUrl)) {
                newMediaNode = createCustomElementNode(`<img src="${imageUrl}" />`);
            } else {
                newMediaNode = createCustomElementNode(
                    `<iframe src="${imageUrl}" sandbox="allow-same-origin allow-scripts allow-presentation" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" allowfullscreen title="Media" width="100%" height="315"></iframe>`
                );
            }
        }

        props.editor
            .chain()
            .focus()
            .deleteRange({ from: pos, to: pos + props.node.nodeSize })
            .insertContentAt(pos, newMediaNode)
            .run();
    };

    const hasFiles = fileItems.length > 0;

    const mediaTypeLabel = mediaType === "image" ? "image" : mediaType === "video" ? "video" : "media";
    const uploadButtonLabel = `Upload ${mediaTypeLabel}`;
    const urlPlaceholder = `Paste ${mediaTypeLabel} URL...`;
    const embedButtonLabel = `Embed ${mediaTypeLabel}`;
    const addMediaLabel = `Add ${mediaTypeLabel}`;

    return (
        <NodeViewWrapper className="tiptap-image-upload" tabIndex={0}>
            {!hasFiles && (
                <Popover>
                    <PopoverTrigger className="w-full">
                        <MediaUploadDragArea onFile={(files) => void handleUpload(files)}>
                            <div className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-500 p-3">
                                <div className="tiptap-image-upload-text flex items-center gap-2">
                                    <CloudArrowUpIcon className="size-8" />
                                    <p>{addMediaLabel}</p>
                                </div>
                            </div>
                        </MediaUploadDragArea>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px]">
                        <Tabs defaultValue="upload">
                            <TabsList>
                                <TabsTrigger value="upload">Upload</TabsTrigger>
                                <TabsTrigger value="url">URL</TabsTrigger>
                            </TabsList>
                            <TabsContent value="upload">
                                <Button asChild>
                                    <button className="relative w-full">
                                        {uploadButtonLabel}
                                        <input
                                            type="file"
                                            accept={computedAccept}
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
                            </TabsContent>
                            <TabsContent value="url">
                                <div className="flex flex-col gap-2">
                                    <Input
                                        type="url"
                                        placeholder={urlPlaceholder}
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        className="w-full"
                                    />
                                    <Button onClick={handleUrlSubmit} disabled={!imageUrl.trim()} className="w-full">
                                        {embedButtonLabel}
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
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
