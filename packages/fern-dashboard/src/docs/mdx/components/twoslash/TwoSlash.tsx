import React, { useMemo } from "react";
import * as jsxRuntime from "react/jsx-runtime";

import { useMDXComponents } from "@mdx-js/react";

interface TwoSlashProps {
    content: {
        code: string;
        jsxElements: string[];
    };
}

export const TwoSlash: React.FC<TwoSlashProps> = ({ content }) => {
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

    return <Component />;
};
