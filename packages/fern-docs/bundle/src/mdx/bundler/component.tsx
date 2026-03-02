"use client";

import { MDXRemote } from "@fern-api/next-mdx-remote";
import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import { getMDXExport } from "mdx-bundler/client";
import React from "react";
import _jsx_runtime from "react/jsx-runtime";
import ReactDOM from "react-dom";

import { ErrorBoundary } from "@/components/error-boundary";

import { createMdxComponents } from "../components";

const globals = {
    // allows us to use MDXProvider to pass components to children
    MdxJsReact: { useMDXComponents },
    React,
    ReactDOM,
    _jsx_runtime
};

export const MdxComponent = React.memo<{
    code: string;
    jsxElements: string[];
}>(
    function MdxComponent({ code, jsxElements }) {
        const { default: Component } = getMDXExport(code, globals);
        return (
            <ErrorBoundary>
                <MDXProvider components={createMdxComponents(jsxElements)}>
                    <Component />
                </MDXProvider>
            </ErrorBoundary>
        );
    },
    (prev, next) => prev.code === next.code
);

export const NextMdxRemoteComponent = React.memo<{
    scope: Record<string, unknown>;
    code: string;
    frontmatter?: Record<string, unknown>;
    jsxElements: string[];
}>(
    function NextMdxRemoteComponent({ scope, code, frontmatter, jsxElements }) {
        // Merge globals (React, etc.) with the provided scope so MDX code can access them
        const scopeWithGlobals = { ...globals, ...scope };

        return (
            <ErrorBoundary>
                <MDXProvider components={createMdxComponents(jsxElements)}>
                    <MDXRemote scope={scopeWithGlobals} frontmatter={frontmatter} compiledSource={code} lazy={false} />
                </MDXProvider>
            </ErrorBoundary>
        );
    },
    (prev, next) => prev.code === next.code
);

export const MdxAside = React.memo<{
    code: string;
    jsxElements: string[];
    engine?: "esbuild" | "next-remote" | "plaintext";
}>(
    function MdxAside({ code, jsxElements, engine }) {
        // plaintext content doesn't have aside sections
        if (engine === "plaintext") {
            return null;
        }
        const { Aside } = getMDXExport(code, globals) ?? {};
        if (Aside == null) {
            return null;
        }
        return (
            <ErrorBoundary>
                {engine === "next-remote" ? (
                    <NextMdxRemoteComponent code={code} scope={{}} jsxElements={jsxElements} />
                ) : (
                    <MDXProvider components={createMdxComponents(jsxElements)}>
                        <Aside />
                    </MDXProvider>
                )}
            </ErrorBoundary>
        );
    },
    (prev, next) => prev.code === next.code
);
