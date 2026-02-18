"use client";

import { HorizontalOverflowMask } from "@fern-docs/components/HorizontalOverflowMask";
import { useNavigation } from "@fern-docs/components/navigation";

import type { Monaco } from "@monaco-editor/react";
import { Code2 } from "lucide-react";
import type monaco from "monaco-editor";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardTooltip } from "@/components/editor/DashboardTooltip";
import { WarningValidationToast } from "@/components/editor/EditorToasts";
import { PanelCardBody, PanelShell } from "@/components/editor/PanelShell";
import { defineAppTheme } from "@/components/editor/theme-utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WrapWithKeyboardShortcut } from "@/components/ui/WrapWithKeyboardShortcut";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useCurrentPage } from "@/providers/CurrentPageContext";
import { useDevMode } from "@/providers/DevModeProvider";
import { useOpenApiSpecs } from "@/providers/OpenApiSpecsContext";
import { getDisambiguatedFileNames } from "@/utils/filePathUtils";
import { isMac } from "@/utils/tiptap-utils";
import { cn } from "@/utils/utils";
import type { EditorLanguage } from "./editor";

const MonacoEditor = dynamic(() => import("./editor"), {
    ssr: false
});

interface DevPanelFile {
    path: string;
    content: string;
    language: EditorLanguage;
    isReadOnly: boolean;
}

/**
 * Determines the editor language based on file extension.
 */
function getLanguageFromPath(path: string): EditorLanguage {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext === "json") {
        return "json";
    }
    if (ext === "yaml" || ext === "yml") {
        return "yaml";
    }
    return "markdown";
}

export default function DevPanel() {
    const { panelOpen, currentPageType } = useDevMode();
    const { currentFilename } = useCurrentPage();
    const { registeredPages, updatePage, emitPageSaveEvent } = useNavigation();
    const { specs: openApiSpecs, generatorsYmlPath, generatorsYmlContent } = useOpenApiSpecs();
    const isEditingDisabled = useEditingDisabled();

    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("");

    const LoadingIndicator = "<!-- Loading content... -->";

    // Extract the current markdown content to use as a dependency for the files useMemo.
    // This ensures the useMemo recomputes when the content changes, since registeredPages
    // is mutated in place and its object reference doesn't change.
    const currentMarkdown = currentFilename ? registeredPages[currentFilename]?.pageData.mdx : undefined;

    // Build the list of files to display based on page type
    const files = useMemo((): DevPanelFile[] => {
        if (currentPageType === "changelog") {
            return [];
        }

        if (currentPageType === "api-reference" && openApiSpecs && openApiSpecs.size > 0) {
            // Show OpenAPI spec files for API reference pages
            const specFiles: DevPanelFile[] = [];
            openApiSpecs.forEach((content, path) => {
                // Skip generators.yml if it's in the specs Map (will be added separately below
                // with the latest content from generatorsYmlContent prop)
                if (generatorsYmlPath && path === generatorsYmlPath) {
                    return;
                }
                specFiles.push({
                    path,
                    content,
                    language: getLanguageFromPath(path),
                    isReadOnly: true
                });
            });

            // Add generators.yml if available (using separate props for latest content)
            if (generatorsYmlPath && generatorsYmlContent) {
                specFiles.push({
                    path: generatorsYmlPath,
                    content: generatorsYmlContent,
                    language: "yaml",
                    isReadOnly: true
                });
            }

            return specFiles;
        }

        // Default: show markdown file for docs pages
        if (currentFilename) {
            const markdown = currentMarkdown || LoadingIndicator;
            return [
                {
                    path: currentFilename,
                    content: markdown,
                    language: "markdown",
                    isReadOnly: false
                }
            ];
        }

        return [];
    }, [currentPageType, currentFilename, currentMarkdown, openApiSpecs, generatorsYmlPath, generatorsYmlContent]);

    // Set initial active tab when files change
    useEffect(() => {
        const firstFile = files[0];
        if (firstFile && (!activeTab || !files.some((f) => f.path === activeTab))) {
            setActiveTab(firstFile.path);
        }
    }, [files, activeTab]);

    // Get the currently active file
    const activeFile = useMemo(() => files.find((f) => f.path === activeTab), [files, activeTab]);

    // Get disambiguated display names for tabs
    const displayNames = useMemo(() => getDisambiguatedFileNames(files.map((f) => f.path)), [files]);

    // Update Monaco editor content when the active file changes
    useEffect(() => {
        if (editorRef.current && activeFile) {
            editorRef.current.setValue(activeFile.content);
        }
        setHasUnsavedChanges(false);
    }, [activeFile]);

    const handleEditorDidMount = useCallback(
        (editorInstance: monaco.editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
            editorRef.current = editorInstance;
            monacoRef.current = monacoInstance;

            // Define and apply custom theme
            const themeName = defineAppTheme(monacoInstance);
            monacoInstance.editor.setTheme(themeName);

            // Listen for content changes to track unsaved changes
            editorInstance.onDidChangeModelContent(() => {
                if (activeFile && !activeFile.isReadOnly) {
                    const currentContent = editorInstance.getValue();
                    setHasUnsavedChanges(currentContent !== activeFile.content);
                }
            });
        },
        [activeFile]
    );

    function handleReset() {
        if (editorRef.current && activeFile) {
            editorRef.current.setValue(activeFile.content);
            setHasUnsavedChanges(false);
        }
    }

    const saveDisabled = !currentFilename || !activeFile || activeFile.isReadOnly;

    function handleUpdate() {
        if (saveDisabled || !activeFile) {
            return;
        }

        const content = editorRef.current?.getValue() || "";

        try {
            updatePage(activeFile.path, { mdx: content });
            const { html, frontmatter } = registeredPages[activeFile.path]?.pageData ?? {};

            // Emit save event
            emitPageSaveEvent({
                filename: activeFile.path,
                frontmatter: frontmatter ?? {},
                html: html ?? ""
            });

            setHasUnsavedChanges(false);
        } catch (conversionError: unknown) {
            const message = conversionError instanceof Error ? conversionError.message : "Unknown error";
            WarningValidationToast(message);
        }
    }

    if (!panelOpen) {
        return null;
    }

    const shortcutKey = isMac() ? "⌘" : "Ctrl";
    const showTabs = files.length > 0;
    const isReadOnlyMode = activeFile?.isReadOnly ?? false;

    return (
        <WrapWithKeyboardShortcut shortcut="s" onShortcut={handleUpdate} disabled={saveDisabled}>
            <div className="flex h-full flex-col">
                {showTabs ? (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col gap-0">
                        {/* Tabs header */}
                        <div className="flex items-center pt-4 pb-2">
                            <TabsList className="mt-0 h-auto border-b-0 bg-transparent p-0" asChild>
                                <HorizontalOverflowMask className="flex gap-0.5">
                                    {files.map((file) => (
                                        <DashboardTooltip
                                            key={file.path}
                                            content={file.path}
                                            side="bottom"
                                            delayDuration={300}
                                        >
                                            <TabsTrigger
                                                value={file.path}
                                                className="mb-0 flex h-8 items-center gap-1.5 rounded-lg border border-transparent! bg-transparent px-3 pb-0 pt-0 text-sm font-normal leading-normal text-gray-1100! before:hidden hover:bg-accent hover:text-accent-foreground! data-[state=active]:border-border! data-[state=active]:bg-background data-[state=active]:before:hidden data-[state=active]:hover:text-accent-foreground! data-[state=active]:text-accent-foreground!"
                                            >
                                                <Code2 className="size-4 shrink-0" />
                                                <span>{displayNames.get(file.path) || file.path}</span>
                                            </TabsTrigger>
                                        </DashboardTooltip>
                                    ))}
                                </HorizontalOverflowMask>
                            </TabsList>
                        </div>

                        {/* Editor content */}
                        <PanelCardBody>
                            {files.map((file) => (
                                <TabsContent
                                    key={file.path}
                                    value={file.path}
                                    className={cn(
                                        "mt-0 min-h-0 flex-1",
                                        file.path === activeTab ? "flex flex-col" : "hidden"
                                    )}
                                >
                                    <div className="min-h-0 flex-1 py-4">
                                        <MonacoEditor
                                            currentMarkdown={file.content}
                                            handleEditorDidMount={handleEditorDidMount}
                                            isEditingDisabled={isEditingDisabled || file.isReadOnly}
                                            language={file.language}
                                        />
                                    </div>
                                </TabsContent>
                            ))}
                        </PanelCardBody>
                    </Tabs>
                ) : (
                    <PanelShell
                        header={
                            <div className="text-muted-foreground flex items-center justify-center gap-2 pb-3 pt-4">
                                <Code2 className="size-4" />
                                <h3 className="text-sm font-medium">Dev Mode</h3>
                            </div>
                        }
                    >
                        <div className="flex flex-1 items-center justify-center py-4 text-muted-foreground">
                            <p className="text-sm">No files to display</p>
                        </div>
                    </PanelShell>
                )}

                {/* Reset/Update buttons - only show for editable files */}
                {!isReadOnlyMode && (
                    <div className="fixed bottom-4 w-fit right-4 z-50 flex items-center gap-2">
                        <div className="flex gap-2">
                            {hasUnsavedChanges && (
                                <Button onClick={handleReset} variant="outline">
                                    Reset
                                </Button>
                            )}
                            <Button onClick={handleUpdate} variant="default" disabled={saveDisabled} className="pr-2">
                                <span>Update</span>
                                <div className="flex gap-0.5">
                                    <Kbd className="py-0">
                                        <span className={isMac() ? "text-base -mb-[2px]" : ""}>{shortcutKey}</span>
                                    </Kbd>
                                    <Kbd>S</Kbd>
                                </div>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </WrapWithKeyboardShortcut>
    );
}
