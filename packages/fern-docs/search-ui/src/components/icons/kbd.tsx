import { cn } from "@fern-docs/components/cn";

import { Kbd } from "@fern-docs/components/kbd";
import { memo } from "react";

export const CommandKbd = memo(({ className }: { className?: string }) => {
    return (
        <span className={cn("inline-flex items-center gap-1", className)}>
            <Kbd>{"⌘"}</Kbd>
        </span>
    );
});

export const ForwardSlashKbd = memo(({ className }: { className?: string }) => {
    return (
        <span className={cn("inline-flex items-center gap-1", className)}>
            <Kbd>{"/"}</Kbd>
        </span>
    );
});
