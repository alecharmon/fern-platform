import { useParams } from "next/navigation";

import FileHandler from "@tiptap/extension-file-handler";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";

import {
  ErrorUploadImageToast,
  SuccessfulUploadImageToast,
  UploadingImageToast,
} from "../../EditorToasts";
import { createCustomElementNode } from "../../extension-custom-element/create-custom-element-node";
import ImageUploadNode from "./image-upload-node-extension";

const private_handleImageUpload = async ({
  file,
  onProgress,
  signal,
  docsUrl,
  slug,
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
    slug,
  });
  onProgress?.({ progress: 90 });

  // Upload file directly to S3 using pre-signed URL (avoids excess server load)
  const uploadResponse = await fetch(response.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
    signal,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(
      `Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`
    );
  }

  // Report progress as completed
  onProgress?.({ progress: 100 });

  return response.imageUrl;
};

export const ConfiguredImageUploadNode = () => {
  const { slug: slugArray, docsUrl: docsUrlParam } = useParams();

  const docsUrl = parseDocsUrlParam({ docsUrl: String(docsUrlParam) });
  const slug = Array.isArray(slugArray)
    ? slugArray?.join("/")
    : String(slugArray);

  return ImageUploadNode.configure({
    accept: "image/*",
    maxSize: 1024 * 1024 * 5, // 5MB
    upload: async (
      file: File,
      onProgress?: (event: { progress: number }) => void,
      signal?: AbortSignal
    ) => {
      try {
        return await private_handleImageUpload({
          file,
          onProgress,
          signal,
          docsUrl,
          slug,
        });
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Upload failed");
      }
    },
    onError: (error) => ErrorUploadImageToast(error),
  });
};

export const ConfiguredFileHandler = () => {
  const { slug: slugArray, docsUrl: docsUrlParam } = useParams();

  const docsUrl = parseDocsUrlParam({ docsUrl: String(docsUrlParam) });
  const slug = Array.isArray(slugArray)
    ? slugArray?.join("/")
    : String(slugArray);

  return FileHandler.configure({
    allowedMimeTypes: ["image/png", "image/jpeg", "image/avif", "image/webp"],
    onDrop: (currentEditor, files, pos) => {
      files.forEach((file) => {
        const fileReader = new FileReader();

        fileReader.readAsDataURL(file);
        fileReader.onload = async () => {
          try {
            UploadingImageToast();
            const imageUrl = await private_handleImageUpload({
              file,
              docsUrl,
              slug,
            });
            const imageNode = createCustomElementNode(
              "img",
              `<img src="${imageUrl}" alt="${file.name}" title="${file.name}" />`
            );
            currentEditor.chain().focus().insertContentAt(pos, imageNode).run();
            SuccessfulUploadImageToast();
          } catch (error) {
            ErrorUploadImageToast(
              error instanceof Error ? error : new Error("Upload failed")
            );
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
            UploadingImageToast();
            const imageUrl = await private_handleImageUpload({
              file,
              docsUrl,
              slug,
            });
            const imageNode = createCustomElementNode(
              "img",
              `<img src="${imageUrl}" alt="${file.name}" title="${file.name}" />`
            );
            currentEditor
              .chain()
              .focus()
              .insertContentAt(currentEditor.state.selection.anchor, imageNode)
              .run();
            SuccessfulUploadImageToast();
          } catch (error) {
            ErrorUploadImageToast(
              error instanceof Error ? error : new Error("Upload failed")
            );
          }
        };
      });
    },
  });
};
