import type { ReactNodeViewProps } from "@tiptap/react";

import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { ChevronDown } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { SearchableDropdown } from "@/components/ui/SearchableDropdown";

import { allLanguages } from "./lowlight-languages";
import type { LowlightInstance } from "./types";

export function createCodeBlockComponent(lowlight: LowlightInstance) {
    return function CodeBlockComponent(props: ReactNodeViewProps) {
        const defaultLanguage = props.node.attrs.language;
        const [searchTerm, setSearchTerm] = useState("");

        const languages = useMemo(() => {
            const filteredLanguages = searchTerm
                ? allLanguages.filter((lang: string) => lang.toLowerCase().includes(searchTerm.toLowerCase()))
                : allLanguages;

            return [
                { value: "null", label: "auto" },
                { value: "disabled", label: "—", disabled: true },
                ...filteredLanguages.map((lang: string) => ({
                    value: lang,
                    label: lang
                }))
            ];
        }, [searchTerm]);

        const currentLanguage = languages.find((lang) => lang.value === defaultLanguage);

        return (
            <NodeViewWrapper className="relative">
                <LanguageLoader
                    lowlight={lowlight}
                    onLoaded={() => {
                        // hack: this will re-trigger the lowlight plugin after the languages are loaded,
                        // which will highlight the code block
                        props.updateAttributes({ language: currentLanguage?.value });
                    }}
                />
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
                    renderItem={(language, onSelect) => (
                        <div
                            className={`flex w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-200 hover:transition-none focus:bg-gray-200 focus:outline-none ${
                                language.disabled ? "cursor-not-allowed opacity-50" : ""
                            }`}
                            onClick={() => !language.disabled && onSelect()}
                        >
                            {language.label}
                        </div>
                    )}
                >
                    <button className="border-border-default absolute right-2 top-2 flex cursor-pointer justify-between gap-3 rounded-md border px-2 py-1 text-xs text-gray-100 hover:bg-gray-300/20">
                        <span className="truncate">{currentLanguage?.label || "auto"}</span>
                        <ChevronDown className="size-4" />
                    </button>
                </SearchableDropdown>

                <pre>
                    <NodeViewContent />
                </pre>
            </NodeViewWrapper>
        );
    };
}

// lazy load the languages to avoid importing all the lowlight package dependencies
// TODO: this currently loads ALL languages, and attempts to do so on each new code block.
// we can make this more efficient by only loading the languages that are needed for the current code block.
function LanguageLoader({ lowlight, onLoaded }: { lowlight: LowlightInstance; onLoaded: () => void }) {
    useEffect(() => {
        const handleLanguageLoading = () => {
            void import("lowlight")
                .then((module) => module.all)
                .then((languages) => {
                    lowlight.register(languages);
                    onLoaded();
                });
        };

        // Load languages on editor creation
        handleLanguageLoading();
    }, [lowlight, onLoaded]);

    return <></>;
}
