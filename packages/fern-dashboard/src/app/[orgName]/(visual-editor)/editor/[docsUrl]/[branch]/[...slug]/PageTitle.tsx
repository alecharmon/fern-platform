"use client";

import { useNavigation } from "@fern-docs/components/navigation";
import { useEffect, useState } from "react";

import { AutoResizingInput } from "@/components/input/AutoResizingInput";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";

export declare namespace PageTitle {
    export interface Props {
        className?: string;
        filename: string;
        initialText?: string;
    }
}

export default function PageTitle({ className, filename, initialText }: PageTitle.Props) {
    const [text, setText] = useState(initialText ?? "");
    const isEditingDisabled = useEditingDisabled();

    const { updatePageFrontmatter, subscribePageSaveEvent } = useNavigation();

    // Subscribe to save events from @devPanel
    useEffect(() => {
        const unsubscribe = subscribePageSaveEvent((event) => {
            setText(event.frontmatter.title ? String(event.frontmatter.title) : "");
        });

        return unsubscribe;
    }, [filename, subscribePageSaveEvent]);

    function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const nextText = e.target.value;
        setText(nextText);
        updatePageFrontmatter(filename, { title: nextText });
    }

    return (
        <div className={["flex", className].join(" ")}>
            <h1 className="fern-page-heading mb-3 h-fit w-full font-extrabold">
                <AutoResizingInput
                    className="mx-5 font-extrabold"
                    name="title"
                    onChange={onChange}
                    placeholder="Add a title"
                    disabled={isEditingDisabled}
                    value={text}
                />
            </h1>
        </div>
    );
}
