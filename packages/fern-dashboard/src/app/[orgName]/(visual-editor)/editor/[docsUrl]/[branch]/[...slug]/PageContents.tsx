"use client";

import { useEffect } from "react";

import { MdxToHtmlResponse } from "@fern-docs/mdx";

import { useMdxState } from "@/providers/MdxStateContext";
import { useOriginalElements } from "@/providers/OriginalElementsContext";

import PageEditor from "./PageEditor";
import PageSubtitle from "./PageSubtitle";
import PageTitle from "./PageTitle";
import { bundleOriginalElements } from "./bundleOriginalElements";

export declare namespace PageContents {
  export interface Props {
    filename: string;
    initialHtml: MdxToHtmlResponse["html"];
    initialFrontmatter: MdxToHtmlResponse["frontmatter"];
    initialOriginalElements: MdxToHtmlResponse["originalElements"];
    initialOriginalFrontmatter: MdxToHtmlResponse["originalFrontmatter"];
  }
}

export default function PageContents({
  filename,
  initialHtml,
  initialFrontmatter,
  initialOriginalElements,
  initialOriginalFrontmatter,
}: PageContents.Props) {
  const { title, subtitle } = initialFrontmatter ?? {};

  const { updateDependencies, changedMdxFiles, syncChanges } = useMdxState();

  const { originalElements, setOriginalElements } = useOriginalElements();

  useEffect(() => {
    void bundleOriginalElements(originalElements).then((bundled) => {
      setOriginalElements(bundled);
    });
  }, [originalElements, setOriginalElements]);

  useEffect(() => {
    updateDependencies(filename, {
      html: initialHtml,
      frontmatter: initialFrontmatter,
      originalElements: initialOriginalElements,
      originalFrontmatter: initialOriginalFrontmatter,
    });
  }, [
    filename,
    initialHtml,
    initialFrontmatter,
    initialOriginalElements,
    initialOriginalFrontmatter,
    updateDependencies,
  ]);

  const changedMdxFile = changedMdxFiles[filename];

  // Watch for changes and sync to server
  useEffect(() => {
    syncChanges(filename);
  }, [changedMdxFile, filename, syncChanges]);

  return (
    <div className="max-w-content-width-wide mx-auto w-full">
      <PageTitle
        className="w-full"
        filename={filename}
        initialText={title ? String(title) : undefined}
      />
      <PageSubtitle
        className="w-full"
        filename={filename}
        initialText={subtitle ? String(subtitle) : undefined}
      />
      <PageEditor
        className="w-full"
        filename={filename}
        initialHtml={initialHtml}
      />
    </div>
  );
}
