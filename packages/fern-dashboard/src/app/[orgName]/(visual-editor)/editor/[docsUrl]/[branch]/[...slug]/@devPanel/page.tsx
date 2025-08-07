"use client";

import { useEffect, useRef, useState } from "react";

import CodeEditor, { Monaco } from "@monaco-editor/react";
import { Code2, Edit3 } from "lucide-react";
import { motion } from "motion/react";

import { mdxToHtml } from "@fern-docs/mdx";

import { WarningValidationToast } from "@/components/editor/EditorToasts";
import { defineAppTheme } from "@/components/editor/theme-utils";
import { Button } from "@/components/ui/button";
import { useCurrentPage } from "@/providers/CurrentPageContext";
import { useDevMode } from "@/providers/DevModeProvider";
import { useMdxState } from "@/providers/MdxStateContext";
import { useOriginalElements } from "@/providers/OriginalElementsContext";
import { cn } from "@/utils/utils";

export default function DevPanel() {
  const { panelOpen } = useDevMode();
  const { currentFilename } = useCurrentPage();
  const { allMdxFiles, stageChanges, frontmatterData } = useMdxState();
  const { setOriginalElements } = useOriginalElements();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [shouldShake, setShouldShake] = useState(false);

  // Get the current file's markdown content
  const activeFilename = currentFilename || Object.keys(allMdxFiles)[0] || "";
  const currentMarkdown =
    allMdxFiles[activeFilename] || "// Loading content...";

  useEffect(() => {
    // Update Monaco editor content when markdown changes (only in read-only mode)
    if (editorRef.current && currentMarkdown && !isEditMode) {
      editorRef.current.setValue(currentMarkdown);
    }
  }, [currentMarkdown, isEditMode]);

  function handleEditorDidMount(editorInstance: any, monacoInstance: Monaco) {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // Define and apply custom theme that uses your app's colors
    const themeName = defineAppTheme(monacoInstance);
    monacoInstance.editor.setTheme(themeName);

    // Listen for attempts to edit in read-only mode
    editorInstance.onDidAttemptReadOnlyEdit(() => {
      if (!isEditMode) {
        setShouldShake(true);
        // Reset shake state after animation completes
        setTimeout(() => setShouldShake(false), 500);
      }
    });
  }

  function handleEnterEditMode() {
    setIsEditMode(true);
    setEditedContent(currentMarkdown);

    // Update editor options to make it editable
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: false });
    }
  }

  function handleCancelEdit() {
    setIsEditMode(false);
    setEditedContent("");

    // Restore original content and make read-only
    if (editorRef.current) {
      editorRef.current.setValue(currentMarkdown);
      editorRef.current.updateOptions({ readOnly: true });
    }
  }

  function handleSaveEdit() {
    const content = editorRef.current?.getValue() || "";

    try {
      // Convert markdown back to HTML using mdxToHtml
      const { html, frontmatter, originalElements } = mdxToHtml(content, {
        treatAsCustomElement: ["code"],
        treatAsUnsupported: ["math"],
      });

      const mergedFrontmatter = {
        ...frontmatterData[activeFilename],
        ...frontmatter,
      };

      // If the new frontmatter is missing a key that exists in the existing frontmatter,
      // we want to remove it from the merged frontmatter
      Object.keys(mergedFrontmatter).forEach((key) => {
        if (!(key in frontmatter)) {
          mergedFrontmatter[key] = key === "title" ? "" : undefined; // Always keep title field
        } else {
          mergedFrontmatter[key] = frontmatter[key];
        }
      });

      // First update the originalElements context so custom elements can render with new hashes
      setOriginalElements(originalElements);

      // Then update the tiptap editor by staging changes with new HTML and originalElements
      stageChanges(activeFilename, {
        html,
        frontmatter: mergedFrontmatter,
        originalElements,
      });

      setIsEditMode(false);

      // Make editor read-only again
      if (editorRef.current) {
        editorRef.current.updateOptions({ readOnly: true });
      }
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
          value={isEditMode ? editedContent : currentMarkdown}
          onMount={handleEditorDidMount}
          theme="app-theme"
          options={{
            readOnly: !isEditMode,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
          }}
        />
      </div>
      {/* Edit button - bottom right */}
      {!isEditMode && (
        <motion.div
          animate={
            shouldShake
              ? {
                  x: [-4, 4, -4, 4, -2, 2, 0],
                  transition: { duration: 0.5, ease: "easeInOut" },
                }
              : {}
          }
          className="fixed bottom-4 right-4"
        >
          <Button onClick={handleEnterEditMode} title="Edit markdown" size="lg">
            <Edit3 className="size-4" />
            Edit
          </Button>
        </motion.div>
      )}

      {/* Cancel/Save buttons - bottom */}
      {isEditMode && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-2">
          <div className="ml-auto flex gap-2">
            <Button onClick={handleCancelEdit} variant="outline" size="lg">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} variant="default" size="lg">
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
