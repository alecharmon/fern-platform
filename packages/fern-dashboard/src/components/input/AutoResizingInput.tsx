import { useEffect, useRef } from "react";

import { cn } from "@/utils/utils";

export function AutoResizingInput({
    className,
    value,
    onChange,
    placeholder,
    name,
    ...props
}: React.ComponentProps<"textarea">) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            // Reset height to get accurate scrollHeight measurement
            textarea.style.height = "0";
            // Set height based on scrollHeight
            const newHeight = textarea.scrollHeight;
            textarea.style.height = `${newHeight}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            className={cn("w-full flex-1 resize-none overflow-hidden focus:outline-none leading-none", className)}
            name={name}
            onChange={onChange}
            placeholder={placeholder}
            value={value}
            rows={1}
            {...props}
        />
    );
}
