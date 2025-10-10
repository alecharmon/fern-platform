"use client";

import { useNavigation } from "@fern-docs/components/navigation";

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

const MonacoEditor = dynamic(() => import("./editor"), {
    ssr: false
});

export default function DevPanel() {
    const { panelOpen } = useDevMode();
    const { currentFilename } = useCurrentPage();
    const { registeredPages, updatePage, emitPageSaveEvent } = useNavigation();
    const isEditingDisabled = useEditingDisabled();
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const LoadingIndicator = "<!-- Loading content... -->";

    const currentMarkdown = (currentFilename && registeredPages[currentFilename]?.pageData.mdx) || LoadingIndicator;

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

    const saveDisabled = !currentFilename;

    function handleUpdate() {
        if (saveDisabled) {
            return;
        }

        const content = editorRef.current?.getValue() || "";

        try {
            updatePage(currentFilename, { mdx: content });
            const { html, frontmatter } = registeredPages[currentFilename]?.pageData ?? {};

            // Emit save event
            emitPageSaveEvent({
                filename: currentFilename,
                frontmatter: frontmatter ?? {},
                html: html ?? ""
            });

            // Reset unsaved changes flag after successful save
            setHasUnsavedChanges(false);
        } catch (conversionError: any) {
            WarningValidationToast(conversionError.message);
        }
    }

    if (!panelOpen) {
        return null;
    }

    return (
        <div className="ml-2 flex h-full flex-col">
            <div className="text-muted-foreground flex items-center justify-center gap-2 pb-3 pt-4">
                <Code2 className="size-4" />
                <h3 className="text-sm font-medium">Dev Mode</h3>
            </div>

            <div className="border-1 rounded-b-none border-b-0 bg-background border-border relative flex flex-1 flex-col overflow-hidden rounded-2xl py-4 shadow-lg">
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
                    <Button onClick={handleUpdate} variant="default" disabled={saveDisabled}>
                        Update
                    </Button>
                </div>
            </div>
        </div>
    );
}
