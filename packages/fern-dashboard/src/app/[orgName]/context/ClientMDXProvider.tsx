"use client";

import React from "react";

import { MDXProvider } from "@mdx-js/react";

import { MDX_COMPONENTS } from "@/docs/mdx/components";

export function ClientMDXProvider({ children }: React.PropsWithChildren) {
  return <MDXProvider components={MDX_COMPONENTS}>{children}</MDXProvider>;
}
