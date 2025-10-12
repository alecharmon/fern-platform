import { type ComponentProps, type ForwardRefExoticComponent, forwardRef, type RefAttributes } from "react";

import { cn } from "./cn";

type KbdProps = ComponentProps<"kbd">;

export const Kbd: ForwardRefExoticComponent<KbdProps & RefAttributes<HTMLSpanElement>> = forwardRef<
    HTMLSpanElement,
    KbdProps
>((props, ref) => {
    return (
        <kbd ref={ref} {...props} className={cn("fern-kbd", props.className)}>
            {props.children}
        </kbd>
    );
});

Kbd.displayName = "Kbd";
