"use client";

import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import { getMDXExport } from "mdx-bundler/client";
import React from "react";
import _jsx_runtime from "react/jsx-runtime";
import ReactDOM from "react-dom";

import { ErrorBoundary } from "@/docs/components/error-boundary";

import { createMdxComponents } from "./";

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

export const MdxAside = React.memo<{
    code: string;
    jsxElements: string[];
}>(
    function MdxAside({ code, jsxElements }) {
        const { Aside } = getMDXExport(code, globals) ?? {};
        if (Aside == null) {
            return null;
        }
        return (
            <ErrorBoundary>
                <MDXProvider components={createMdxComponents(jsxElements)}>
                    <Aside />
                </MDXProvider>
            </ErrorBoundary>
        );
    },
    (prev, next) => prev.code === next.code
);
