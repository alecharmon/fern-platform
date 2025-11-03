import { cleanLanguage } from "@fern-api/fdr-sdk/api-definition";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { FernSyntaxHighlighter } from "@fern-docs/components/syntax-highlighter";
import { TextSelection } from "@tiptap/pm/state";
import type { ReactNodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { ChevronDown } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";

import { allLanguages } from "./lowlight-languages";

export function createCodeBlockComponent() {
    return function CodeBlockComponent(props: ReactNodeViewProps) {
        const defaultLanguage = props.node.attrs.language;
        const [searchTerm, setSearchTerm] = useState("");
        const [localFocus, setLocalFocus] = useState(false);
        const [selectionTick, setSelectionTick] = useState(0);

        const languages = useMemo(() => {
            const filtered = searchTerm
                ? allLanguages.filter((lang: string) => lang.toLowerCase().includes(searchTerm.toLowerCase()))
                : allLanguages;
            const mapped = filtered.map((lang: string) => ({
                value: lang,
                label: lang
            }));
            return searchTerm
                ? mapped
                : [{ value: "null", label: "auto" }, { value: "disabled", label: "—", disabled: true }, ...mapped];
        }, [searchTerm]);

        const currentLanguage = languages.find((lang) => lang.value === defaultLanguage);

        const getCurrentCode = useCallback(() => {
            const pos = props.getPos();
            if (typeof pos === "number") {
                const node = props.editor.state.doc.nodeAt(pos);
                if (node) {
                    return node.textContent;
                }
            }
            return "";
        }, [props.getPos, props.editor]);

        useEffect(() => {
            const handler = () => {
                const pos = props.getPos();
                if (typeof pos === "number") {
                    const { from, to } = props.editor.state.selection;
                    const start = pos + 1; // first content position
                    const end = pos + props.node.nodeSize - 1; // last content position
                    const inside = from >= start && to <= end;
                    if (!inside) {
                        setLocalFocus(false);
                    }
                }
                setSelectionTick((t) => t + 1);
            };
            props.editor.on("selectionUpdate", handler);
            props.editor.on("blur", handler);
            return () => {
                props.editor.off("selectionUpdate", handler);
                props.editor.off("blur", handler);
            };
        }, [props.editor, props.getPos, props.node.nodeSize]);

        const isSelectionInside = useMemo(() => {
            const pos = props.getPos();
            if (typeof pos !== "number") return false;
            const sel = props.editor.state.selection;
            const start = pos + 1; // first content position
            const end = pos + props.node.nodeSize - 1; // last content position
            if (sel instanceof TextSelection) {
                return sel.from >= start && sel.to <= end;
            }
            return false;
        }, [props.getPos, props.editor.state.selection, props.node.nodeSize, selectionTick]);

        const isEditing = localFocus || isSelectionInside;

        const language = defaultLanguage || "plaintext";
        const codeStr = props.node.textContent ?? "";

        const handleDisplayClick = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                const pos = props.getPos();

                if (props.editor.isDestroyed) return;
                if (typeof pos !== "number") return;

                const docSize = props.editor.state.doc.content.size;
                const targetPos = Math.min(Math.max(pos + 1, 0), docSize);

                try {
                    props.editor.chain().focus().setTextSelection(targetPos).run();
                    setLocalFocus(true);
                } catch (error) {
                    console.warn("Failed to set selection in code block:", error);
                }
            },
            [props.getPos, props.editor]
        );

        return (
            <NodeViewWrapper className="relative">
                <div
                    className={cn(
                        "not-prose bg-card-background border-card-border rounded-3 shadow-card-grayscale group relative mb-6 mt-4 flex w-full border",
                        "ProseMirror-selectednode-override"
                    )}
                    style={{
                        outline: "none",
                        boxShadow:
                            "var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)"
                    }}
                >
                    {/* Top-right toolbar with language dropdown and copy button */}
                    <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
                        <SearchableDropdown
                            items={languages}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            onSelect={(language) => {
                                if (!language.disabled) {
                                    props.updateAttributes({ language: language.value });
                                }
                            }}
                            searchPlaceholder="Search languages..."
                            emptyMessage="No languages found"
                            getItemKey={(language) => language.value}
                            renderItem={(language, onSelect, isHighlighted) => (
                                <div
                                    className={`flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                        language.disabled ? "cursor-not-allowed opacity-50" : ""
                                    } ${isHighlighted ? "bg-gray-200 dark:bg-gray-700" : ""} hover:bg-gray-200 dark:hover:bg-gray-700 hover:transition-none focus:bg-gray-200 dark:focus:bg-gray-700 focus:outline-none`}
                                    onClick={() => !language.disabled && onSelect()}
                                >
                                    {language.label}
                                </div>
                            )}
                        >
                            <button className="border-border-default flex cursor-pointer items-center justify-between gap-2 rounded-md border bg-card-background px-2 py-1 text-xs text-black opacity-0 backdrop-blur transition hover:bg-gray-300/20 group-hover:opacity-100 dark:text-black">
                                <span className="truncate">{currentLanguage?.label || "auto"}</span>
                                <ChevronDown className="size-4" />
                            </button>
                        </SearchableDropdown>
                        <CopyToClipboardButton
                            className="opacity-0 backdrop-blur transition group-hover:opacity-100"
                            content={getCurrentCode}
                        />
                    </div>

                    {isEditing ? (
                        <pre
                            className="code-block-root not-prose w-full px-4 py-3 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none"
                            onFocus={() => setLocalFocus(true)}
                            onBlur={() => setLocalFocus(false)}
                        >
                            <code className={language !== "null" ? `language-${language}` : undefined}>
                                <NodeViewContent />
                            </code>
                        </pre>
                    ) : (
                        <div className="w-full" onMouseDown={handleDisplayClick}>
                            <FernSyntaxHighlighter code={codeStr} language={cleanLanguage(language)} fontSize="base" />
                        </div>
                    )}
                </div>
            </NodeViewWrapper>
        );
    };
}
