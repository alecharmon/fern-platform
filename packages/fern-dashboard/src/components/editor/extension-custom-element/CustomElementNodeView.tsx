import { useMemo } from "react";

import { useMDXComponents } from "@mdx-js/react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { getMDXComponent } from "mdx-bundler/client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/docs/components/error-boundary";
import { MDX_COMPONENTS } from "@/docs/mdx/components";
import { useOriginalElements } from "@/providers/OriginalElementsContext";

import { UnsupportedContent } from "../UnsupportedContent";

export const CustomElementNodeView = (props: NodeViewProps) => {
  const { attrs, textContent } = props.node;
  const hash = attrs["data-hash"];

  const { originalElements } = useOriginalElements();
  const originalElement = useMemo(
    () => originalElements[hash],
    [originalElements, hash]
  );

  // Check that the element has code and is supported, otherwise return undefined
  function getComponentIfExists(
    code: string | undefined,
    name: string | undefined
  ) {
    return code && name && typeof MDX_COMPONENTS[name] !== "undefined"
      ? getMDXComponent(code)
      : undefined;
  }

  const components = useMDXComponents();

  const Component = useMemo(() => {
    // If element exists but hasn't been bundled yet, show a loading state
    if (!originalElement?.bundleAttempted) {
      const LoadingComponent = () => <Skeleton className="h-24 w-full" />;
      LoadingComponent.displayName = "LoadingComponent";
      return LoadingComponent;
    }

    // Use component if it exists, otherwise render an unsupported content component
    const Component =
      getComponentIfExists(originalElement?.code, originalElement?.name) ??
      (() => <UnsupportedContent>{textContent}</UnsupportedContent>);
    return Component;
  }, [
    originalElement?.code,
    originalElement?.name,
    originalElement?.bundleAttempted,
    textContent,
  ]);

  return (
    <ErrorBoundary
      fallback={
        <NodeViewWrapper>
          <UnsupportedContent>{textContent}</UnsupportedContent>
        </NodeViewWrapper>
      }
    >
      <NodeViewWrapper>
        <Component components={components} />
      </NodeViewWrapper>
    </ErrorBoundary>
  );
};
