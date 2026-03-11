import type { FernLink } from "@fern-docs/components/FernLink";

import { last } from "es-toolkit/array";
import { zipSync } from "fflate";
import React, { type ComponentProps, type PropsWithChildren } from "react";

import { Button } from "../button";
import { Card } from "../card";
import { A } from "../html";

async function fetchFile(url: string): Promise<{ data: Uint8Array; filename: string }> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return {
        data: new Uint8Array(buffer),
        filename: last(url.split("/")) || "file"
    };
}

function triggerDownload(blob: Blob, filename: string): void {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
}

async function downloadSingleFile(src: string, filename?: string): Promise<void> {
    const { data } = await fetchFile(src);
    const blob = new Blob([data]);
    triggerDownload(blob, filename || last(src.split("/")) || "");
}

async function downloadMultipleFilesAsZip(sources: string[], filename?: string): Promise<void> {
    const files = await Promise.all(sources.map(fetchFile));
    const zipData: Record<string, Uint8Array> = {};
    for (const file of files) {
        zipData[file.filename] = file.data;
    }
    const zipped = zipSync(zipData);
    const blob = new Blob([zipped], { type: "application/zip" });
    triggerDownload(blob, filename || "download.zip");
}

interface DownloadProps {
    src?: string;
    sources?: string[];
    filename?: string;
    className?: string;
}

export function Download({ children, src, sources, filename, className }: PropsWithChildren<DownloadProps>) {
    const effectiveSrc = src || (sources?.length === 1 ? sources[0] : undefined);
    const isMultiFile = sources != null && sources.length > 1;

    if (!effectiveSrc && !isMultiFile) {
        return children;
    }

    const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (isMultiFile && sources) {
            e.preventDefault();
            try {
                await downloadMultipleFilesAsZip(sources, filename);
            } catch (error) {
                console.error("Error downloading files as zip:", error);
            }
            return;
        }

        if (!effectiveSrc) {
            return;
        }

        // enable downloads from the same origin, or data urls
        if (effectiveSrc.startsWith(window.location.origin + "/") || effectiveSrc.startsWith("data:")) {
            return;
        }

        e.preventDefault();
        try {
            await downloadSingleFile(effectiveSrc, filename);
        } catch (error) {
            console.error("Error downloading file:", error);
        }
    };

    const href = effectiveSrc || "#";

    // Extract the single valid child element from children.
    // MDX may add whitespace text nodes around the child, making children an array
    // instead of a single element, which would cause the type check below to fail.
    const child = React.Children.toArray(children).find(React.isValidElement);

    if (
        child != null &&
        React.isValidElement<ComponentProps<typeof FernLink>>(child) &&
        (child.type === A || child.type === Card || child.type === Button)
    ) {
        return React.cloneElement(child, {
            href,
            className,
            download: filename || true,
            onClick: (e) => {
                void (async () => {
                    try {
                        await handleClick(e);
                    } catch (e) {
                        console.error("Failed to download:", e);
                    }
                })();
            }
        });
    }

    return (
        <A
            className={className}
            href={href}
            download={filename || true}
            onClick={(e) => {
                void (async () => {
                    try {
                        await handleClick(e);
                    } catch (e) {
                        console.error("Failed to download:", e);
                    }
                })();
            }}
        >
            {children}
        </A>
    );
}
