"use client";

import * as React from "react";

import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/utils/utils";

function Switch({
    className,
    thumbContent,
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
    thumbContent?: React.ReactNode;
}) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 shadow-xs peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-md border border-transparent outline-none transition-all focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none flex size-5 items-center justify-center rounded-sm ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%+1px)] data-[state=unchecked]:translate-x-[1px]"
                )}
            >
                {thumbContent}
            </SwitchPrimitive.Thumb>
        </SwitchPrimitive.Root>
    );
}

export { Switch };
