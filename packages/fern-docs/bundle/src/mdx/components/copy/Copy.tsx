"use client";

import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { type PropsWithChildren, type ReactElement, useRef } from "react";

interface CopyProps {
    /**
     * Optional custom content to copy to clipboard.
     * If not provided, the text content of the children will be copied.
     */
    clipboard?: string;
}

export function Copy({ children, clipboard }: PropsWithChildren<CopyProps>): ReactElement {
    const spanRef = useRef<HTMLSpanElement>(null);
    const resolveContent = () => clipboard ?? spanRef.current?.textContent?.trim() ?? "";

    return (
        <CopyToClipboardButton content={resolveContent}>
            {(onClick) => (
                <span
                    ref={spanRef}
                    onClick={onClick}
                    className={cn(
                        "fern-copy-inline",
                        "inline-flex cursor-pointer items-baseline rounded-1 px-1.5 align-baseline transition-colors",
                        "bg-(color:--grayscale-a3) text-(color:--grayscale-a12) hover:bg-(color:--grayscale-a4)"
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onClick?.(e as any);
                        }
                    }}
                >
                    {children}
                </span>
            )}
        </CopyToClipboardButton>
    );
}
