"use client";

import { mdxToHtml } from "@fern-docs/mdx";
import type { Monaco } from "@monaco-editor/react";
import { Code2 } from "lucide-react";
import type monaco from "monaco-editor";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { WarningValidationToast } from "@/components/editor/EditorToasts";
import { defineAppTheme } from "@/components/editor/theme-utils";
import { Button } from "@/components/ui/button";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useCurrentPage } from "@/providers/CurrentPageContext";
import { useDevMode } from "@/providers/DevModeProvider";
import { usePages } from "@/providers/PagesStoreContext";
import { cn } from "@/utils/utils";

const MonacoEditor = dynamic(() => import("./editor"), {
    ssr: false
});

export default function DevPanel() {
    const { panelOpen } = useDevMode();
    const { currentFilename } = useCurrentPage();
    const { allMdxFiles, updatePage, emitSaveEvent } = usePages();
    const isEditingDisabled = useEditingDisabled();
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const LoadingIndicator = "// Loading content...";
    // Get the current file's markdown content
    const activeFilename = currentFilename || Object.keys(allMdxFiles)[0] || "";
    const currentMarkdown = allMdxFiles[activeFilename] || LoadingIndicator;

    useEffect(() => {
        // Update Monaco editor content when markdown changes
        if (editorRef.current && currentMarkdown) {
            editorRef.current.setValue(currentMarkdown);
        }
        // Reset unsaved changes flag when currentMarkdown changes
        setHasUnsavedChanges(false);
    }, [currentMarkdown]);

    function handleEditorDidMount(editorInstance: monaco.editor.IStandaloneCodeEditor, monacoInstance: Monaco) {
        editorRef.current = editorInstance;
        monacoRef.current = monacoInstance;

        // Define and apply custom theme that uses your app's colors
        const themeName = defineAppTheme(monacoInstance);
        monacoInstance.editor.setTheme(themeName);

        // Listen for content changes to track unsaved changes
        editorInstance.onDidChangeModelContent(() => {
            const currentContent = editorInstance.getValue();
            setHasUnsavedChanges(currentContent !== currentMarkdown);
        });
    }

    function handleReset() {
        // Restore original content
        if (editorRef.current) {
            editorRef.current.setValue(currentMarkdown);
            setHasUnsavedChanges(false);
        }
    }

    function handleUpdate() {
        const content = editorRef.current?.getValue() || "";

        try {
            // Convert markdown back to HTML using mdxToHtml
            const { html, frontmatter } = mdxToHtml(content, {
                treatAsUnsupported: ["math"]
            });

            updatePage(activeFilename, {
                html,
                frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined,
                changedNodes: {}
            });

            // Emit save event
            emitSaveEvent({
                fileName: activeFilename,
                html
            });

            // Reset unsaved changes flag after successful save
            setHasUnsavedChanges(false);
        } catch (conversionError: any) {
            WarningValidationToast(conversionError.message);
        }
    }

    return (
        <div
            className={cn(
                "flex max-w-[600px] flex-col transition-all duration-300 ease-in-out",
                panelOpen ? "ml-2 w-1/3 translate-x-0 opacity-100" : "w-0 translate-x-full opacity-0"
            )}
        >
            <div className="text-muted-foreground flex items-center justify-center gap-2 pb-3 pt-4">
                <Code2 className="size-4" />
                <h3 className="text-sm font-medium">Dev Mode</h3>
            </div>

            <div className="border-1 bg-background border-border relative flex flex-1 flex-col overflow-hidden rounded-2xl py-4 shadow-lg">
                <MonacoEditor
                    currentMarkdown={currentMarkdown}
                    handleEditorDidMount={handleEditorDidMount}
                    isEditingDisabled={isEditingDisabled}
                />
            </div>

            {/* Reset/Update buttons - bottom */}
            <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-2">
                <div className="ml-auto flex gap-2">
                    {hasUnsavedChanges && (
                        <Button onClick={handleReset} variant="outline">
                            Reset
                        </Button>
                    )}
                    <Button onClick={handleUpdate} variant="default">
                        Update
                    </Button>
                </div>
            </div>
        </div>
    );
}
