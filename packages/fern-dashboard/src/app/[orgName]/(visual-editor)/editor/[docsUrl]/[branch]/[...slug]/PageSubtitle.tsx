"use client";

import { cn } from "@fern-docs/components/cn";
import { useNavigation } from "@fern-docs/components/navigation";
import { useEffect, useState } from "react";

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
    const [text, setText] = useState(initialText ?? "");
    const isEditingDisabled = useEditingDisabled();

    const { updatePageFrontmatter, subscribePageSaveEvent } = useNavigation();

    useEffect(() => {
        setText(initialText ?? "");
    }, [filename, initialText]);

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
                className="break-words leading-7 text-(color:--grayscale-a11)"
                name="subtitle"
                onChange={onChange}
                disabled={isEditingDisabled}
                placeholder="Add a subtitle"
                value={text}
            />
        </div>
    );
}
