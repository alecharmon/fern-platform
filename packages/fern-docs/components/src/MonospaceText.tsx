import { type ComponentProps, forwardRef, type PropsWithChildren } from "react";

import { cn } from "./cn";

export declare namespace MonospaceText {
    export type Props = PropsWithChildren<{
        className?: string;
    }>;
}

export const MonospaceText = forwardRef<HTMLSpanElement, ComponentProps<"span">>(function MonospaceText(
    { className, children, ...props },
    ref
) {
    return (
        <span ref={ref} className={cn(className, "font-mono")} {...props}>
            {children}
        </span>
    );
});
