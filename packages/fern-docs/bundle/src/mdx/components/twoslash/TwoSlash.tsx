//eslint-i18n-disable
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { useMDXComponents } from "@mdx-js/react";
import React, { useMemo, useRef } from "react";
import * as jsxRuntime from "react/jsx-runtime";

interface TwoSlashProps {
    content: {
        code: string;
        jsxElements: string[];
        value?: string;
    };
}

/**
 * TwoSlash component renders a dynamic code block and provides a copy button.
 * The copy button will copy the code as rendered in the DOM (if possible), or fall back to the raw code.
 */
export const TwoSlash: React.FC<TwoSlashProps> = ({ content }) => {
    // Ref to the container so we can scope DOM queries for the copy button
    const containerRef = useRef<HTMLDivElement>(null);

    const Component = useMemo(() => {
        try {
            // Create the globals object with all necessary dependencies
            const globals = {
                MdxJsReact: { useMDXComponents },
                React,
                _jsx_runtime: jsxRuntime
            };

            // Create a module-like environment
            const moduleExports: Record<string, unknown> = {};
            const moduleObj = { exports: moduleExports };

            // Evaluate the code in a module context
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            const result = new Function("module", "exports", "React", "_jsx_runtime", "MdxJsReact", content.code)(
                moduleObj,
                moduleExports,
                globals.React,
                globals._jsx_runtime,
                globals.MdxJsReact
            );

            // Get the component from either the function result or module exports
            let Component: React.ComponentType;

            if (result && typeof result === "object" && "default" in result) {
                // Handle the case where result is { default: [Getter] }
                Component = result.default as React.ComponentType;
            } else {
                Component = (result || moduleExports.default || moduleExports) as React.ComponentType;
            }

            // Ensure we have a valid React component
            if (typeof Component !== "function") {
                console.error("Invalid component type:", typeof Component);
                throw new Error(`Invalid component type: ${typeof Component}`);
            }

            Component.displayName = "TwoSlashComponent";
            return Component;
        } catch (error) {
            console.error("Failed to evaluate serialized component:", error);
            const ErrorComponent = () => (
                <div style={{ color: "red", padding: "1rem" }}>
                    Error loading component: {error instanceof Error ? error.message : String(error)}
                </div>
            );
            ErrorComponent.displayName = "TwoSlashErrorComponent";
            return ErrorComponent;
        }
    }, [content]);

    return (
        <div className="twoslash-container" style={{ position: "relative" }} ref={containerRef}>
            <CopyToClipboardButton
                className="twoslash-copy-btn absolute right-2 top-2 z-10"
                // Copies the code as rendered in the DOM, or falls back to the raw code.
                content={() => {
                    // Use content.value if present, otherwise nothing
                    return content.value ?? "";
                }}
            />
            <Component />
        </div>
    );
};
