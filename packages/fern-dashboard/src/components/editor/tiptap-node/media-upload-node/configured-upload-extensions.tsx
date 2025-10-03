import { useParams } from "next/navigation";

import FileHandler from "@tiptap/extension-file-handler";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";

import { ErrorUploadMediaToast, SuccessfulUploadMediaToast, UploadingMediaToast } from "../../EditorToasts";
import { createCustomElementNode } from "../../extension-custom-element/create-custom-element-node";
import MediaUploadNode from "./media-upload-node-extension";

const private_handleMediaUpload = async ({
    file,
    onProgress,
    signal,
    docsUrl,
    slug
}: {
    file: File;
    onProgress?: (event: { progress: number }) => void;
    signal?: AbortSignal;
    docsUrl: string;
    slug: string;
}) => {
    onProgress?.({ progress: 20 });

    // Get pre-signed URL from our API
    const response = await DashboardApiClient.generateSignedUploadUrl({
        fileName: file.name,
        contentType: file.type,
        docsUrl,
        slug
    });
    onProgress?.({ progress: 90 });

    // Upload file directly to S3 using pre-signed URL (avoids excess server load)
    const uploadResponse = await fetch(response.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
            "Content-Type": file.type
        },
        signal
    });

    if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`);
    }

    // Report progress as completed
    onProgress?.({ progress: 100 });

    return response.imageUrl;
};

export const ConfiguredMediaUploadNode = () => {
    const { slug: slugArray, docsUrl: docsUrlParam } = useParams();

    const docsUrl = parseDocsUrlParam({ docsUrl: String(docsUrlParam) });
    const slug = Array.isArray(slugArray) ? slugArray?.join("/") : String(slugArray);

    return MediaUploadNode.configure({
        accept: "image/*,video/*",
        maxSize: 1024 * 1024 * 5, // 5MB
        upload: async (file: File, onProgress?: (event: { progress: number }) => void, signal?: AbortSignal) => {
            try {
                return await private_handleMediaUpload({
                    file,
                    onProgress,
                    signal,
                    docsUrl,
                    slug
                });
            } catch (error) {
                if (error instanceof Error) {
                    throw error;
                }
                throw new Error("Upload failed");
            }
        },
        onError: (error) => ErrorUploadMediaToast(error)
    });
};

// Helper functions for file type detection
const isVideo = (file: File): boolean => {
    return file.type.startsWith("video/");
};

const createMediaNode = (file: File, mediaUrl: string) => {
    const filename = file.name.replace(/\.[^/.]+$/, "") || "unknown";

    if (isVideo(file)) {
        return createCustomElementNode(`<video src="${mediaUrl}" title="${filename}" controls></video>`);
    } else {
        return createCustomElementNode(`<img src="${mediaUrl}" alt="${filename}" title="${filename}" />`);
    }
};

export const ConfiguredFileHandler = () => {
    const { slug: slugArray, docsUrl: docsUrlParam } = useParams();

    const docsUrl = parseDocsUrlParam({ docsUrl: String(docsUrlParam) });
    const slug = Array.isArray(slugArray) ? slugArray?.join("/") : String(slugArray);

    return FileHandler.configure({
        allowedMimeTypes: [
            "image/png",
            "image/jpeg",
            "image/avif",
            "image/webp",
            "image/gif",
            "video/mp4",
            "video/webm",
            "video/ogg",
            "video/avi",
            "video/mov"
        ],
        onDrop: (currentEditor, files, pos) => {
            files.forEach((file) => {
                const fileReader = new FileReader();

                fileReader.readAsDataURL(file);
                fileReader.onload = async () => {
                    try {
                        UploadingMediaToast();
                        const mediaUrl = await private_handleMediaUpload({
                            file,
                            docsUrl,
                            slug
                        });
                        const mediaNode = createMediaNode(file, mediaUrl);
                        currentEditor.chain().focus().insertContentAt(pos, mediaNode).run();
                        SuccessfulUploadMediaToast();
                    } catch (error) {
                        ErrorUploadMediaToast(error instanceof Error ? error : new Error("Upload failed"));
                    }
                };
            });
        },
        onPaste: (currentEditor, files, htmlContent) => {
            files.forEach((file) => {
                if (htmlContent) {
                    // if there is htmlContent, stop manual insertion & let other extensions handle insertion via inputRule
                    // you could extract the pasted file from this url string and upload it to a server for example
                    return;
                }

                const fileReader = new FileReader();

                fileReader.readAsDataURL(file);
                fileReader.onload = async () => {
                    try {
                        UploadingMediaToast();
                        const mediaUrl = await private_handleMediaUpload({
                            file,
                            docsUrl,
                            slug
                        });
                        const mediaNode = createMediaNode(file, mediaUrl);
                        currentEditor
                            .chain()
                            .focus()
                            .insertContentAt(currentEditor.state.selection.anchor, mediaNode)
                            .run();
                        SuccessfulUploadMediaToast();
                    } catch (error) {
                        ErrorUploadMediaToast(error instanceof Error ? error : new Error("Upload failed"));
                    }
                };
            });
        }
    });
};
