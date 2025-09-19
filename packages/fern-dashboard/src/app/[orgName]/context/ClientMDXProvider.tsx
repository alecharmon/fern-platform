"use client";

import React from "react";

import { MDXProvider } from "@mdx-js/react";

import { MDX_COMPONENTS } from "@/docs/mdx/components";

import { InterceptedChildren } from "../../../components/editor/editor-component/EditorComponentContext";

export function ClientMDXProvider({ children }: React.PropsWithChildren) {
  const editorComponents = {
    ...MDX_COMPONENTS,
    InterceptedChildren: InterceptedChildren,
  };

  return <MDXProvider components={editorComponents}>{children}</MDXProvider>;
}
