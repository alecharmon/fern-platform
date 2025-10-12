"use client";

import { MDXProvider } from "@mdx-js/react";
import type React from "react";

import { InterceptedChildren } from "@/components/editor/editor-component/EditorComponentChildrenContext";
import { MDX_COMPONENTS } from "@/docs/mdx/components";

export function ClientMDXProvider({ children }: React.PropsWithChildren) {
    const editorComponents = {
        ...MDX_COMPONENTS,
        InterceptedChildren: InterceptedChildren
    };

    return <MDXProvider components={editorComponents}>{children}</MDXProvider>;
}
