import { type ComponentProps, type RefObject, forwardRef, useEffect, useRef } from "react";

import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";

export const TextArea = forwardRef<
    HTMLTextAreaElement,
    ComponentProps<"textarea"> & {
        onValueChange?: (value: string) => void;
        minLines?: number;
        maxLines?: number;
        lineHeight?: number;
        padding?: number;
    }
>(({ onValueChange, minLines, maxLines, lineHeight = 24, padding = 0, value, ...props }, forwardedRef) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    useAutosizeTextArea(inputRef, minLines, lineHeight, padding, value);
    return (
        <textarea
            ref={composeRefs(inputRef, forwardedRef)}
            value={value}
            {...props}
            onChange={composeEventHandlers(props.onChange, (e) => {
                onValueChange?.(e.target.value);
            })}
            style={{
                maxHeight: maxLines ? `${maxLines * lineHeight + padding * 2}px` : undefined,
                ...props.style
            }}
        />
    );
});

TextArea.displayName = "TextArea";

// Updates the height of a <textarea> when the value changes.
function useAutosizeTextArea(
    textAreaRef: RefObject<HTMLTextAreaElement | null>,
    minLines: number = 1,
    lineHeight: number = 24,
    padding: number = 0,
    value: string | number | readonly string[] | undefined
): void {
    const minHeight = Math.max(minLines, 1) * Math.max(lineHeight, 10) + padding * 2;
    useEffect(() => {
        const textArea = textAreaRef.current;
        if (!textArea) {
            return;
        }

        const handleInput = () => {
            const value = textArea.value;
            if (!value || value.trim() === "") {
                textArea.style.height = minHeight + "px";
                return;
            }

            // We need to reset the height momentarily to get the correct scrollHeight for the textarea
            textArea.style.height = "0px";
            const scrollHeight = textArea.scrollHeight;

            // We then set the height directly, outside of the render loop
            // Trying to set this with state or a ref will product an incorrect value.
            textArea.style.height = Math.max(minHeight, scrollHeight) + "px";
        };

        handleInput();

        textArea.addEventListener("input", handleInput);
        return () => {
            textArea.removeEventListener("input", handleInput);
        };
    }, [minHeight, textAreaRef, value]);
}
