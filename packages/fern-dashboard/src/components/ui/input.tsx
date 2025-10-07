import type * as React from "react";

import { cn } from "@/utils/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "file:text-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input shadow-xs flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px]",
                "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                className
            )}
            onWheel={(e) => {
                // avoid wheel events from changing the value of the input
                if (type === "number") {
                    (e.target as HTMLInputElement).blur();
                }
            }}
            {...props}
        />
    );
}

export { Input };
