"use client";

import { ReactNode, createContext, useContext, useState } from "react";

import { MDXProvider } from "@mdx-js/react";

import { OriginalElements } from "@fern-docs/mdx";

import { MDX_COMPONENTS } from "@/docs/mdx/components";

export type WithCode<T> = T & {
  [K in keyof T]: T[K] & { code?: string; bundleAttempted?: boolean };
};

export const OriginalElementsContext = createContext<{
  originalElements: WithCode<OriginalElements>;
  setOriginalElements: (originalElements: WithCode<OriginalElements>) => void;
}>({
  originalElements: {},
  setOriginalElements: () => undefined,
});

export function OriginalElementsProvider({
  originalElements,
  children,
}: {
  originalElements: WithCode<OriginalElements>;
  children: ReactNode;
}) {
  const [originalElementsStore, setOriginalElementsStore] =
    useState<WithCode<OriginalElements>>(originalElements);

  return (
    <OriginalElementsContext.Provider
      value={{
        originalElements: originalElementsStore,
        setOriginalElements: setOriginalElementsStore,
      }}
    >
      <MDXProvider components={MDX_COMPONENTS}>{children}</MDXProvider>
    </OriginalElementsContext.Provider>
  );
}

export function useOriginalElements() {
  return useContext(OriginalElementsContext);
}
