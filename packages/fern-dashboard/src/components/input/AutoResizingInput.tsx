import { useEffect, useLayoutEffect, useRef } from "react";

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

    const measureHeight = (textarea: HTMLTextAreaElement) => {
        textarea.style.height = "auto";
        const computedStyle = window.getComputedStyle(textarea);
        const borderBox = computedStyle.boxSizing === "border-box";
        const padding = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
        const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize);

        let height = textarea.scrollHeight;
        if (!borderBox) {
            height -= padding;
        }
        height = Math.max(height, lineHeight);
        textarea.style.height = `${Math.ceil(height)}px`;
    };

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            measureHeight(textarea);
        }
    }, [value]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        let unmounted = false;

        const raf = requestAnimationFrame(() => {
            if (!unmounted && textareaRef.current) {
                measureHeight(textareaRef.current);
            }
        });

        const fontsPromise = (document as any).fonts?.ready;
        if (fontsPromise) {
            fontsPromise.then(() => {
                if (!unmounted && textareaRef.current) {
                    measureHeight(textareaRef.current);
                }
            });
        }

        let resizeObserver: ResizeObserver | undefined;
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                if (!unmounted && textareaRef.current) {
                    measureHeight(textareaRef.current);
                }
            });
            resizeObserver.observe(textarea);
        }

        return () => {
            unmounted = true;
            cancelAnimationFrame(raf);
            resizeObserver?.disconnect();
        };
    }, []);

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
