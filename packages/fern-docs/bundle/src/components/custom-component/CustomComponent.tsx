"use client";

import { ErrorBoundary } from "@fern-docs/components/error-boundary";
import { getMDXExport } from "mdx-bundler/client";
import React, { useMemo } from "react";
import _jsx_runtime from "react/jsx-runtime";
import ReactDOM from "react-dom";

const globals = {
    React,
    ReactDOM,
    _jsx_runtime
};

/**
 * Error display component for extraction/compilation errors (not runtime errors)
 */
function CustomComponentError({ title, message, details }: { title: string; message: string; details?: string }) {
    return (
        <div
            style={{
                padding: "16px",
                margin: "8px 0",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                fontFamily: "system-ui, -apple-system, sans-serif"
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ color: "#dc2626", fontSize: "20px" }}>{"⚠️"}</span>
                <strong style={{ color: "#991b1b", fontSize: "14px" }}>{title}</strong>
            </div>
            <p style={{ color: "#7f1d1d", margin: "0 0 8px 0", fontSize: "13px" }}>{message}</p>
            {details && (
                <details style={{ marginTop: "8px" }}>
                    <summary style={{ color: "#991b1b", cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>
                        {"Technical Details"}
                    </summary>
                    <pre
                        style={{
                            marginTop: "8px",
                            padding: "8px",
                            backgroundColor: "#fff",
                            border: "1px solid #fecaca",
                            borderRadius: "4px",
                            fontSize: "11px",
                            overflow: "auto",
                            maxHeight: "150px",
                            color: "#7f1d1d"
                        }}
                    >
                        {details}
                    </pre>
                </details>
            )}
            <p style={{ color: "#9ca3af", margin: "8px 0 0 0", fontSize: "11px" }}>
                {"Custom components can only use plain HTML elements and React. External imports are not supported."}
            </p>
        </div>
    );
}

export const CustomComponent = React.memo<{
    code: string;
    className?: string;
    componentType?: string;
}>(
    function CustomComponent({ code, className, componentType = "component" }) {
        // Extract the component from compiled code
        const { Component, extractionError } = useMemo(() => {
            try {
                const exports = getMDXExport(code, globals);
                return { Component: exports?.default ?? null, extractionError: null };
            } catch (err) {
                console.error("[CustomComponent] Failed to extract component:", err);
                return { Component: null, extractionError: err as Error };
            }
        }, [code]);

        // Show error if extraction failed
        if (extractionError) {
            return (
                <CustomComponentError
                    title={`Custom ${componentType.charAt(0).toUpperCase() + componentType.slice(1)} Compilation Error`}
                    message={`Failed to compile custom ${componentType}. Check the console for details.`}
                    details={`${extractionError.name}: ${extractionError.message}`}
                />
            );
        }

        // Show error if no default export
        if (Component == null) {
            return (
                <CustomComponentError
                    title={`Custom ${componentType.charAt(0).toUpperCase() + componentType.slice(1)} Error`}
                    message={`No default export found in custom ${componentType}. Make sure your component has a default export.`}
                    details="The component file must export a default function or component."
                />
            );
        }

        // Wrap in the same ErrorBoundary used by MDX content
        // This shows "Something went wrong" for runtime errors like undefined imports
        return (
            <ErrorBoundary>
                <div className={className}>
                    <Component />
                </div>
            </ErrorBoundary>
        );
    },
    (prev, next) =>
        prev.code === next.code && prev.className === next.className && prev.componentType === next.componentType
);
