import CodeEditor, { loader, type Monaco } from "@monaco-editor/react";
import type monaco from "monaco-editor";
import { useEffect, useState } from "react";

export default function MonacoEditor({
    currentMarkdown,
    handleEditorDidMount,
    isEditingDisabled
}: {
    currentMarkdown: string;
    handleEditorDidMount: (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => void;
    isEditingDisabled: boolean;
}) {
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        if (typeof window !== "undefined") {
            loader.init().then(() => {
                setIsLoading(false);
            });
        }
    }, []);

    // TODO: add a loading state
    if (isLoading) {
        return null;
    }

    return (
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
                readOnly: isEditingDisabled
            }}
        />
    );
}
