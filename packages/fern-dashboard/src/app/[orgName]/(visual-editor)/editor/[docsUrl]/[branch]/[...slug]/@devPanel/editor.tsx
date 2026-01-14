import CodeEditor, { loader, type Monaco } from "@monaco-editor/react";
import type monaco from "monaco-editor";
import { useEffect, useState } from "react";

export type EditorLanguage = "markdown" | "yaml" | "json";

export default function MonacoEditor({
    currentMarkdown,
    handleEditorDidMount,
    isEditingDisabled,
    language = "markdown"
}: {
    currentMarkdown: string;
    handleEditorDidMount: (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => void;
    isEditingDisabled: boolean;
    language?: EditorLanguage;
}) {
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        if (typeof window !== "undefined") {
            void loader.init().then(() => {
                setIsLoading(false);
            });
        }
    }, []);

    return (
        <>
            {isLoading ? (
                <div />
            ) : (
                <CodeEditor
                    height="100%"
                    language={language}
                    value={currentMarkdown}
                    onMount={handleEditorDidMount}
                    theme="app-theme"
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        readOnly: isEditingDisabled
                    }}
                />
            )}
        </>
    );
}
