import { useMemo } from "react";

import { useMDXComponents } from "@mdx-js/react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import DOMPurify from "dompurify";
import { getMDXComponent } from "mdx-bundler/client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/docs/components/error-boundary";
import { MDX_COMPONENTS } from "@/docs/mdx/components";
import { useOriginalElements } from "@/providers/OriginalElementsContext";

import { UnsupportedContent } from "../UnsupportedContent";
import { useCSS } from "./CSSContext";
import { StyleInjector } from "./StyleInjector";
import {
  convertJSXToHTML,
  hasJSXSyntax,
  looksLikeHTML,
} from "./jsx-to-html-converter";

export const CustomElementNodeView = (props: NodeViewProps) => {
  const { attrs, textContent } = props.node;
  const hash = attrs["data-hash"];

  const cssConfig = useCSS();
  const { originalElements } = useOriginalElements();
  const components = useMDXComponents();

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

  // Extract CSS from config
  const inlineCss = useMemo(() => {
    return cssConfig?.inline && Array.isArray(cssConfig.inline)
      ? cssConfig.inline
      : [];
  }, [cssConfig?.inline]);

  // Process HTML content if available
  const htmlContent = useMemo(() => {
    if (!originalElement?.content) {
      return null;
    }

    let content = originalElement.content;
    let extractedCSS: string[] = [];

    // Check if content has JSX syntax first
    if (hasJSXSyntax(originalElement.content)) {
      try {
        // TODO: investigate if we can use mdxToHtml function from convert.ts instead
        const result = convertJSXToHTML(originalElement.content);
        content = result.html;
        extractedCSS = result.css;
        return { content, css: extractedCSS };
      } catch (error) {
        console.warn("Failed to convert JSX to HTML:", error);
        // Fall back to original content
        content = originalElement.content;
      }
    }

    // Check if it looks like HTML (after JSX conversion)
    if (looksLikeHTML(content)) {
      return { content, css: extractedCSS };
    }

    return null;
  }, [originalElement?.content]);

  const Component = useMemo(() => {
    // If element exists but hasn't been bundled yet AND we have content to bundle, show loading
    if (originalElement?.content && !originalElement?.bundleAttempted) {
      const LoadingComponent = () => <Skeleton className="h-24 w-full" />;
      LoadingComponent.displayName = "LoadingComponent";
      return LoadingComponent;
    }

    // Step 1: Try MDX rendering if we have code AND a valid MDX component name
    if (
      originalElement?.code &&
      originalElement?.name &&
      typeof MDX_COMPONENTS[originalElement.name] !== "undefined"
    ) {
      try {
        const MDXComponent = getMDXComponent(originalElement.code);
        const MDXWrapper = () => <MDXComponent components={components} />;
        MDXWrapper.displayName = "MDXWrapper";
        return MDXWrapper;
      } catch (error) {
        console.warn("Failed to create MDX component:", error);
        // Fall through to HTML rendering if MDX fails
      }
    }

    // Step 2: Try HTML rendering if content looks like HTML
    if (htmlContent) {
      const HTMLWrapper = () => (
        <>
          <StyleInjector
            styles={[
              ...inlineCss,
              ...htmlContent.css,
              "html-content comment { display: none; }",
            ].join("\n")}
            id={hash}
          />
          <div
            id={`custom-element-${hash}`}
            className="custom-element-container"
          >
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(htmlContent.content),
              }}
              className="html-content"
            />
          </div>
        </>
      );
      HTMLWrapper.displayName = "HTMLWrapper";
      return HTMLWrapper;
    }

    // Step 3: Fallback to unsupported content
    const fallbackComponent =
      getComponentIfExists(originalElement?.code, originalElement?.name) ??
      (() => <UnsupportedContent>{textContent}</UnsupportedContent>);
    return fallbackComponent;
  }, [
    originalElement?.code,
    originalElement?.name,
    originalElement?.bundleAttempted,
    originalElement?.content,
    htmlContent,
    inlineCss,
    hash,
    components,
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
        <Component />
      </NodeViewWrapper>
    </ErrorBoundary>
  );
};
