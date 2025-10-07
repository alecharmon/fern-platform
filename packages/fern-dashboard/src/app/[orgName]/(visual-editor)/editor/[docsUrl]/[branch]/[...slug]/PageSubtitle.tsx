"use client";

import { useEffect, useState } from "react";

import { cn } from "@fern-docs/components/cn";
import { useNavigation } from "@fern-docs/components/navigation";

import { AutoResizingInput } from "@/components/input/AutoResizingInput";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";

export declare namespace PageSubtitle {
    export interface Props {
        className?: string;
        filename: string;
        initialText?: string;
    }
}

export default function PageSubtitle({ className, filename, initialText }: PageSubtitle.Props) {
    const [text, setText] = useState(initialText);
    const isEditingDisabled = useEditingDisabled();

    const { updatePageFrontmatter, subscribePageSaveEvent } = useNavigation();

    // Subscribe to save events from @devPanel
    useEffect(() => {
        const unsubscribe = subscribePageSaveEvent((event) => {
            setText(event.frontmatter.subtitle ? String(event.frontmatter.subtitle) : "");
        });

        return unsubscribe;
    }, [filename, subscribePageSaveEvent]);

    function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const nextText = e.target.value;
        setText(nextText);
        updatePageFrontmatter(filename, {
            subtitle: nextText.trim() !== "" ? nextText : undefined
        });
    }

    return (
        <div className={cn("flex", className)}>
            <AutoResizingInput
                className="mx-5 text-base"
                name="subtitle"
                onChange={onChange}
                disabled={isEditingDisabled}
                placeholder="Add a subtitle"
                value={text}
            />
        </div>
    );
}
