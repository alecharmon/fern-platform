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

/**
 * Internal props passed from server (SharedLayout) to client (CustomComponent).
 * Uses ReactNode because functions cannot cross the server/client boundary.
 */
export interface FernComponentNodes {
    Logo: React.ReactNode;
    Search: React.ReactNode;
    ProductSwitcher: React.ReactNode;
    VersionSwitcher: React.ReactNode;
    LanguageSwitcher: React.ReactNode;
    NavbarLinks: React.ReactNode;
    LoginButton: React.ReactNode;
    ThemeSwitch: React.ReactNode;
    Tabs: React.ReactNode;
}

/**
 * User-facing Fern component props.
 * Each property is a React function component that users can render with JSX syntax:
 * ```tsx
 * export default function MyHeader({ Fern }) {
 *     return <header><Fern.Logo /><Fern.Search /></header>;
 * }
 * ```
 */
export interface FernComponentProps {
    Logo: React.FC;
    Search: React.FC;
    ProductSwitcher: React.FC;
    VersionSwitcher: React.FC;
    LanguageSwitcher: React.FC;
    NavbarLinks: React.FC;
    LoginButton: React.FC;
    ThemeSwitch: React.FC;
    Tabs: React.FC;
}

export const CustomComponent = React.memo<{
    code: string;
    className?: string;
    componentType?: string;
    fernNodes?: FernComponentNodes;
}>(
    function CustomComponent({ code, className, componentType = "component", fernNodes }) {
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

        // Convert ReactNode values to function components so users can render with JSX syntax.
        // We do this on the client side because functions cannot cross the server/client boundary.
        // Must be called before any early returns to satisfy Rules of Hooks.
        // Always returns a defined object so users can safely write <Fern.Logo /> without null checks.
        const Noop: React.FC = () => null;
        const fernComponents: FernComponentProps = useMemo(
            () => ({
                Logo: fernNodes ? () => <>{fernNodes.Logo}</> : Noop,
                Search: fernNodes ? () => <>{fernNodes.Search}</> : Noop,
                ProductSwitcher: fernNodes ? () => <>{fernNodes.ProductSwitcher}</> : Noop,
                VersionSwitcher: fernNodes ? () => <>{fernNodes.VersionSwitcher}</> : Noop,
                LanguageSwitcher: fernNodes ? () => <>{fernNodes.LanguageSwitcher}</> : Noop,
                NavbarLinks: fernNodes ? () => <>{fernNodes.NavbarLinks}</> : Noop,
                LoginButton: fernNodes ? () => <>{fernNodes.LoginButton}</> : Noop,
                ThemeSwitch: fernNodes ? () => <>{fernNodes.ThemeSwitch}</> : Noop,
                Tabs: fernNodes ? () => <>{fernNodes.Tabs}</> : Noop
            }),
            [fernNodes]
        );

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
                    <Component Fern={fernComponents} />
                </div>
            </ErrorBoundary>
        );
    },
    (prev, next) =>
        prev.code === next.code &&
        prev.className === next.className &&
        prev.componentType === next.componentType &&
        prev.fernNodes === next.fernNodes
);
