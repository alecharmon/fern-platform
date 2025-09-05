import React, { useEffect, useMemo, useState } from "react";

import { useMDXComponents } from "@mdx-js/react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import DOMPurify from "dompurify";
import { getMDXComponent } from "mdx-bundler/client";

import { bundleMDX } from "@/app/[orgName]/(visual-editor)/editor/[docsUrl]/[branch]/[...slug]/bundleEditorMdx";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/docs/components/error-boundary";
import { MDX_COMPONENTS } from "@/docs/mdx/components";

import { UnsupportedContent } from "../UnsupportedContent";
import { useCSS } from "./CSSContext";
import { StyleInjector } from "./StyleInjector";
import {
  convertJSXToHTML,
  hasJSXSyntax,
  looksLikeHTML,
} from "./jsx-to-html-converter";

// Separate components to avoid mount-remount cycles
const LoadingComponent = React.memo(() => (
  <Skeleton className="m-2 h-24 w-full" />
));
LoadingComponent.displayName = "LoadingComponent";

interface MDXWrapperProps {
  code: string;
  hash: string;
  components: ReturnType<typeof useMDXComponents>;
}

const MDXWrapper = ({ code, hash, components }: MDXWrapperProps) => {
  const MDXComponent = useMemo(() => {
    try {
      return getMDXComponent(code);
    } catch (error) {
      console.warn(
        "[CustomElementNodeView] Failed to create MDX component:",
        "with hash:",
        hash,
        "Error:",
        error
      );
      throw error;
    }
  }, [code, hash]);

  return <MDXComponent components={components} />;
};

MDXWrapper.displayName = "MDXWrapper";

interface HTMLWrapperProps {
  content: string;
  css: string[];
  inlineCss: string[];
  hash: string;
  name?: string;
}

const HTMLWrapper = React.memo(
  ({ content, css, inlineCss, hash }: HTMLWrapperProps) => {
    return (
      <>
        <StyleInjector
          styles={[
            ...inlineCss,
            ...css,
            "html-content comment { display: none; }",
          ].join("\n")}
          id={hash}
        />
        <div id={`custom-element-${hash}`} className="custom-element-container">
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(content),
            }}
            className="html-content"
          />
        </div>
      </>
    );
  }
);
HTMLWrapper.displayName = "HTMLWrapper";

interface FallbackWrapperProps {
  code?: string;
  name?: string;
  textContent: string;
}

const FallbackWrapper = React.memo(
  ({ code, name, textContent }: FallbackWrapperProps) => {
    const Component = useMemo(() => {
      if (code && name && typeof MDX_COMPONENTS[name] !== "undefined") {
        try {
          return getMDXComponent(code);
        } catch (error) {
          console.warn("Failed to create fallback MDX component:", error);
        }
      }
      const Component = () => (
        <UnsupportedContent>{textContent}</UnsupportedContent>
      );
      Component.displayName = "UnsupportedContent";
      return Component;
    }, [code, name, textContent]);

    return <Component />;
  }
);
FallbackWrapper.displayName = "FallbackWrapper";

// Main renderer component that handles all the conditional logic internally
interface CustomElementRendererProps {
  name: string;
  code: string | undefined;
  htmlContent: { content: string; css: string[] } | null;
  inlineCss: string[];
  hash: string;
  components: ReturnType<typeof useMDXComponents>;
  textContent: string;
}

const CustomElementRenderer = React.memo(
  ({
    name,
    code,
    htmlContent,
    inlineCss,
    hash,
    components,
    textContent,
  }: CustomElementRendererProps) => {
    // Step 1: Try MDX rendering if we have code AND a valid MDX component name
    if (code != null && typeof MDX_COMPONENTS[name] !== "undefined") {
      try {
        return <MDXWrapper code={code} hash={hash} components={components} />;
      } catch (error) {
        console.warn(
          "[CustomElementNodeView] Failed to create MDX component:",
          name,
          "with hash:",
          hash,
          "Error:",
          error
        );
        // Fall through to HTML rendering if MDX fails
      }
    } else if (code != null && typeof MDX_COMPONENTS[name] === "undefined") {
      console.warn(
        "[CustomElementNodeView] MDX component name not found in MDX_COMPONENTS:",
        name,
        "with hash:",
        hash
      );
    }

    // Step 2: Try HTML rendering if content looks like HTML
    if (htmlContent) {
      return (
        <HTMLWrapper
          content={htmlContent.content}
          css={htmlContent.css}
          inlineCss={inlineCss}
          hash={hash}
          name={name}
        />
      );
    }

    // Step 3: Fallback to unsupported content
    console.warn(
      "[CustomElementNodeView] Falling back to unsupported content for element with hash:",
      hash,
      "name:",
      name,
      "textContent:",
      textContent
    );
    return (
      <FallbackWrapper code={code} name={name} textContent={textContent} />
    );
  }
);
CustomElementRenderer.displayName = "CustomElementRenderer";

interface CustomElementBundling {
  type: "BUNDLING";
}

interface CustomElementError {
  type: "ERROR";
  message: string;
}

interface CustomElementBundled {
  type: "BUNDLED";
  code: string;
}

type CustomElementState =
  | CustomElementBundling
  | CustomElementBundled
  | CustomElementError;

export const CustomElementNodeView = (props: NodeViewProps) => {
  const [state, setState] = useState<CustomElementState>({ type: "BUNDLING" });
  const { node } = props;
  const { attrs } = node;

  const mdx = attrs["fve-mdx-content"];
  const name = attrs["fve-data-name"];
  const hash = attrs["fve-data-hash"];
  const textContent = attrs["fve-mdx-content"];

  useEffect(() => {
    void (async () => {
      try {
        const result = await bundleMDX(mdx);
        setState({ type: "BUNDLED", code: result.code });
      } catch (error) {
        console.error("Error bundling MDX:", error);
        setState({ type: "ERROR", message: String(error) });
      }
    })();
  }, [mdx, setState]);

  const cssConfig = useCSS();
  const components = useMDXComponents();

  // Extract CSS from config
  const inlineCss = useMemo(() => {
    return cssConfig?.inline && Array.isArray(cssConfig.inline)
      ? cssConfig.inline
      : [];
  }, [cssConfig?.inline]);

  // Process HTML content if available
  const htmlContent = useMemo(() => {
    let content: string = textContent;
    let extractedCSS: string[] = [];

    // Check if content has JSX syntax first
    if (hasJSXSyntax(textContent)) {
      try {
        // TODO: investigate if we can use mdxToHtml function from convert.ts instead
        const result = convertJSXToHTML(textContent);
        content = result.html;
        extractedCSS = result.css;
        return { content, css: extractedCSS };
      } catch (error) {
        console.warn("Failed to convert JSX to HTML:", error);
        // Fall back to original content
        content = textContent;
      }
    }

    // Check if it looks like HTML (after JSX conversion)
    if (looksLikeHTML(content)) {
      return { content, css: extractedCSS };
    }

    return null;
  }, [textContent]);

  return (
    <ErrorBoundary
      fallback={
        <NodeViewWrapper>
          <UnsupportedContent>{textContent}</UnsupportedContent>
        </NodeViewWrapper>
      }
    >
      <NodeViewWrapper>
        {state.type === "BUNDLING" ? (
          <LoadingComponent />
        ) : state.type === "ERROR" ? (
          <UnsupportedContent>{textContent}</UnsupportedContent>
        ) : (
          <CustomElementRenderer
            name={name}
            code={state.code}
            htmlContent={htmlContent}
            inlineCss={inlineCss}
            hash={hash}
            components={components}
            textContent={textContent}
          />
        )}
      </NodeViewWrapper>
    </ErrorBoundary>
  );
};
