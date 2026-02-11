"use client";

import { useCopyToClipboard } from "@fern-ui/react-commons";
import { composeEventHandlers } from "@radix-ui/primitive";
import { Check, Copy, Info } from "lucide-react";
import React from "react";
import { FernTooltip, FernTooltipProvider } from "../../FernTooltip";

import { jsonPropertyPathToString } from "../examples/JsonPropertyPath";
import { useTypeDefinitionContext } from "./TypeDefinitionContext";

export function PropertyKey({ children, ...props }: React.ComponentPropsWithoutRef<"span">) {
    const { jsonPropertyPath, slug, isResponse, isGraphQL } = useTypeDefinitionContext();

    const base = jsonPropertyPathToString(jsonPropertyPath);
    const name = typeof children === "string" ? children : undefined;
    const lastPart = jsonPropertyPath.at(-1);
    const includesCurrent =
        lastPart?.type === "objectProperty" && "propertyName" in lastPart && lastPart.propertyName === name;
    const fullPath = includesCurrent ? base : name ? (base ? `${base}.${name}` : name) : base;
    const showTooltip = !isGraphQL && (includesCurrent ? jsonPropertyPath.length > 1 : jsonPropertyPath.length > 0);

    const { copyToClipboard, wasJustCopied } = useCopyToClipboard(fullPath);

    const pathSegments = fullPath.split(".");

    const [tooltipOpen, setTooltipOpen] = React.useState(false);
    const isCoarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

    return (
        <>
            <span
                {...props}
                onPointerEnter={composeEventHandlers(props.onPointerEnter, () => {
                    window.dispatchEvent(
                        new CustomEvent(`property-hover-on:${slug}:${isResponse ? "response" : "request"}`, {
                            detail: jsonPropertyPath
                        })
                    );
                })}
                onPointerOut={composeEventHandlers(props.onPointerOut, () => {
                    window.dispatchEvent(
                        new CustomEvent(`property-hover-off:${slug}:${isResponse ? "response" : "request"}`, {
                            detail: jsonPropertyPath
                        })
                    );
                })}
            >
                {children}
            </span>

            {showTooltip && (
                <FernTooltipProvider delayDuration={0}>
                    <FernTooltip
                        content={
                            <div className="flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-left" style={{ whiteSpace: "normal", wordBreak: "normal" }}>
                                        {pathSegments.map((segment, idx) => (
                                            <React.Fragment key={idx}>
                                                {idx > 0 && (
                                                    <>
                                                        <span className="opacity-60">.</span>
                                                        <wbr />
                                                    </>
                                                )}
                                                <span
                                                    className={
                                                        idx === pathSegments.length - 1 ? undefined : "opacity-60"
                                                    }
                                                >
                                                    {segment}
                                                </span>
                                            </React.Fragment>
                                        ))}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void copyToClipboard?.();
                                        }}
                                        className="hover:text-(color:--accent-a11) text-(color:--grayscale-a11) mt-1 shrink-0 transition-colors"
                                        aria-label="Copy property path"
                                    >
                                        {wasJustCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                                    </button>
                                </div>
                            </div>
                        }
                        side="right"
                        sideOffset={6}
                        {...(isCoarsePointer ? { open: tooltipOpen, onOpenChange: setTooltipOpen } : {})}
                    >
                        <button
                            onClick={(e) => {
                                if (isCoarsePointer) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTooltipOpen((prev) => !prev);
                                }
                            }}
                            onPointerEnter={() => {
                                window.dispatchEvent(
                                    new CustomEvent(
                                        `property-hover-on:${slug}:${isResponse ? "response" : "request"}`,
                                        {
                                            detail: jsonPropertyPath
                                        }
                                    )
                                );
                            }}
                            onPointerLeave={() => {
                                window.dispatchEvent(
                                    new CustomEvent(
                                        `property-hover-off:${slug}:${isResponse ? "response" : "request"}`,
                                        {
                                            detail: jsonPropertyPath
                                        }
                                    )
                                );
                            }}
                            aria-haspopup="dialog"
                            aria-expanded={isCoarsePointer ? tooltipOpen : undefined}
                            className="text-(color:--grayscale-a9) hover:text-(color:--grayscale-a11) ml-1 inline-flex items-center transition-colors"
                            aria-label="Show property path"
                        >
                            <Info className="size-3.5" />
                        </button>
                    </FernTooltip>
                </FernTooltipProvider>
            )}
        </>
    );
}
