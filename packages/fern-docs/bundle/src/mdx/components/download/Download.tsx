import type { FernLink } from "@fern-docs/components/FernLink";

import { last } from "es-toolkit/array";
import React, { type ComponentProps, type PropsWithChildren } from "react";

import { Button } from "../button";
import { Card } from "../card";
import { A } from "../html";

export function Download({
    children,
    src,
    filename,
    className
}: PropsWithChildren<{ src?: string; filename?: string; className?: string }>) {
    if (!src) {
        return children;
    }

    const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        // enable downloads from the same origin, or data urls
        if (src.startsWith(window.location.origin + "/") || src.startsWith("data:")) {
            return;
        }

        e.preventDefault();
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            // if the filename is not provided, use the last part of the src
            a.download = filename || last(src.split("/")) || "";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Error downloading file:", error);
            // if we can't download the file, open it in a new tab
            window.open(src, "_blank");
        }
    };

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
            href: src,
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
            href={src}
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
