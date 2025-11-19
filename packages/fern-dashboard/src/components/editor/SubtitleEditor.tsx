"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorProvider, type EditorProviderProps, useCurrentEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

import { useDebounce } from "@/hooks/useDebounce";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { cn } from "@/utils/utils";
import { MarkdownPasteExtension } from "./extension-markdown-paste";
import TextBubbleMenu from "./TextBubbleMenu";

const extensions = [
    StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
        link: false
    }),
    Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
            class: "fern-mdx-link"
        }
    }),
    MarkdownPasteExtension,
    Placeholder.configure({
        placeholder: "Add a subtitle",
        emptyEditorClass: "is-empty",
        emptyNodeClass: "is-empty"
    })
];

export declare namespace SubtitleEditor {
    export interface Props {
        autofocus?: boolean;
        className?: string;
        initialContent: string;
        onCreate?: EditorProviderProps["onCreate"];
        onUpdate?: EditorProviderProps["onUpdate"];
    }
}

export default function SubtitleEditor({
    autofocus,
    className,
    initialContent,
    onCreate,
    onUpdate
}: SubtitleEditor.Props) {
    const isEditingDisabled = useEditingDisabled();
    const skipFirstUpdateRef = useRef(true);

    const { debouncedCallback: debouncedOnUpdate, flush } = useDebounce(
        (props: Parameters<NonNullable<EditorProviderProps["onUpdate"]>>[0]) => {
            onUpdate?.(props);
        },
        100,
        300
    );

    const handleUpdate: EditorProviderProps["onUpdate"] = (props) => {
        if (skipFirstUpdateRef.current) {
            skipFirstUpdateRef.current = false;
            return;
        }

        debouncedOnUpdate(props);
    };

    return (
        <EditorProvider
            autofocus={autofocus}
            extensions={extensions}
            editorProps={{
                attributes: {
                    class: "focus:outline-none max-w-none"
                }
            }}
            parseOptions={{
                preserveWhitespace: true
            }}
            content={initialContent}
            editorContainerProps={{
                className: cn(className, "relative")
            }}
            immediatelyRender={false}
            onCreate={onCreate}
            onUpdate={handleUpdate}
            onBlur={() => {
                flush();
            }}
        >
            <div>{!isEditingDisabled && <TextBubbleMenu disableNodeTypeSwitching />}</div>
            <SubtitleEditingDisabledListener />
        </EditorProvider>
    );
}

function SubtitleEditingDisabledListener() {
    const { editor } = useCurrentEditor();
    const isEditingDisabled = useEditingDisabled();

    useEffect(() => {
        if (isEditingDisabled) {
            editor?.setEditable(false, false);
        } else {
            editor?.setEditable(true, false);
        }
    }, [isEditingDisabled, editor]);

    return <></>;
}
