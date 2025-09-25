"use client";

import { useEffect, useRef } from "react";

import CodeEditor, { Monaco } from "@monaco-editor/react";
import { Code2 } from "lucide-react";

import { mdxToHtml } from "@fern-docs/mdx";

import { WarningValidationToast } from "@/components/editor/EditorToasts";
import { defineAppTheme } from "@/components/editor/theme-utils";
import { Button } from "@/components/ui/button";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useCurrentPage } from "@/providers/CurrentPageContext";
import { useDevMode } from "@/providers/DevModeProvider";
import { usePages } from "@/providers/PagesStoreContext";
import { cn } from "@/utils/utils";

export default function DevPanel() {
  const { panelOpen } = useDevMode();
  const { currentFilename } = useCurrentPage();
  const { allMdxFiles, updatePage, emitSaveEvent } = usePages();
  const isEditingDisabled = useEditingDisabled();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const LoadingIndicator = "// Loading content...";
  // Get the current file's markdown content
  const activeFilename = currentFilename || Object.keys(allMdxFiles)[0] || "";
  const currentMarkdown = allMdxFiles[activeFilename] || LoadingIndicator;

  useEffect(() => {
    // Update Monaco editor content when markdown changes
    if (editorRef.current && currentMarkdown) {
      editorRef.current.setValue(currentMarkdown);
    }
  }, [currentMarkdown]);

  function handleEditorDidMount(editorInstance: any, monacoInstance: Monaco) {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // Define and apply custom theme that uses your app's colors
    const themeName = defineAppTheme(monacoInstance);
    monacoInstance.editor.setTheme(themeName);
  }

  function handleCancelEdit() {
    // Restore original content and make read-only
    if (editorRef.current) {
      editorRef.current.setValue(currentMarkdown);
    }
  }

  function handleSaveEdit() {
    const content = editorRef.current?.getValue() || "";

    try {
      // Convert markdown back to HTML using mdxToHtml
      const { html, frontmatter } = mdxToHtml(content, {
        treatAsUnsupported: ["math"],
      });

      updatePage(activeFilename, {
        html,
        frontmatter:
          Object.keys(frontmatter).length > 0 ? frontmatter : undefined,
        changedNodes: {},
      });

      // Emit save event
      emitSaveEvent({
        fileName: activeFilename,
        html,
      });
    } catch (conversionError: any) {
      WarningValidationToast(conversionError.message);
    }
  }

  return (
    <div
      className={cn(
        "flex max-w-[600px] flex-col transition-all duration-300 ease-in-out",
        panelOpen
          ? "ml-2 w-1/3 translate-x-0 opacity-100"
          : "w-0 translate-x-full opacity-0"
      )}
    >
      <div className="text-muted-foreground flex items-center justify-center gap-2 pb-3 pt-4">
        <Code2 className="size-4" />
        <h3 className="text-sm font-medium">Dev Mode</h3>
      </div>

      <div className="border-1 bg-background border-border relative flex flex-1 flex-col overflow-hidden rounded-2xl py-4 shadow-lg">
        <CodeEditor
          height="100%"
          language="markdown"
          value={currentMarkdown}
          onMount={handleEditorDidMount}
          theme="app-theme"
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            readOnly: isEditingDisabled,
          }}
        />
      </div>

      {/* Cancel/Save buttons - bottom */}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-2">
        <div className="ml-auto flex gap-2">
          <Button onClick={handleCancelEdit} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} variant="default">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
