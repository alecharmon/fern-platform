"use client";

import { cn } from "@fern-docs/components/cn";
import { useNavigation } from "@fern-docs/components/navigation";
import { htmlToMdx, mdxToHtml } from "@fern-docs/mdx";
import { useEffect, useMemo, useRef, useState } from "react";

import SubtitleEditor from "@/components/editor/SubtitleEditor";

export declare namespace PageSubtitle {
    export interface Props {
        className?: string;
        filename: string;
        initialText?: string;
    }
}

export default function PageSubtitle({ className, filename, initialText }: PageSubtitle.Props) {
    const [mdx, setMdx] = useState(initialText ?? "");
    const editorRef = useRef<any>(null);

    const { updatePageFrontmatter, subscribePageSaveEvent } = useNavigation();

    const html = useMemo(() => {
        if (!mdx) {
            return "";
        }
        try {
            return mdxToHtml(mdx).html;
        } catch (error) {
            console.error("Error converting MDX to HTML:", error);
            return "";
        }
    }, [mdx]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: if filename changes, we want to reset the text
    useEffect(() => {
        setMdx(initialText ?? "");
    }, [filename, initialText]);

    // Subscribe to save events from @devPanel
    useEffect(() => {
        const unsubscribe = subscribePageSaveEvent((event) => {
            const newSubtitle = event.frontmatter.subtitle ? String(event.frontmatter.subtitle) : "";
            setMdx(newSubtitle);
        });

        return unsubscribe;
    }, [subscribePageSaveEvent]);

    useEffect(() => {
        if (editorRef.current) {
            if (editorRef.current.isFocused) {
                return;
            }

            const currentHtml = editorRef.current.getHTML();
            if (currentHtml !== html) {
                queueMicrotask(() => {
                    editorRef.current?.commands.setContent(html, false);
                });
            }
        }
    }, [html]);

    return (
        <div className={cn("flex", className)}>
            <SubtitleEditor
                className="break-words leading-7 text-(color:--grayscale-a11) w-full"
                initialContent={html}
                onCreate={({ editor }) => {
                    editorRef.current = editor;
                }}
                onUpdate={({ editor }) => {
                    try {
                        const editorHtml = editor.getHTML();
                        const result = htmlToMdx(editorHtml);
                        const nextMdx = result.mdx.trim();

                        setMdx(nextMdx);
                        updatePageFrontmatter(filename, {
                            subtitle: nextMdx !== "" ? nextMdx : undefined
                        });
                    } catch (error) {
                        console.error("Error converting HTML to MDX:", error);
                    }
                }}
            />
        </div>
    );
}
