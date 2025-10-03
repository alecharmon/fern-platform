"use client";

import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/utils/utils";

const buttonVariants = cva(
    "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive text-gray-1100 inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "bg-primary disabled:bg-primary/50 shadow-xs hover:bg-primary/90 text-white dark:text-black",
                destructive:
                    "bg-destructive disabled:bg-destructive/50 shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-white",
                outline:
                    "bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 border-border border disabled:opacity-50",
                secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 disabled:opacity-50",
                ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 disabled:opacity-50",
                link: "text-primary underline-offset-4 hover:underline disabled:opacity-50"
            },
            size: {
                default: "h-9 rounded-md px-4 py-2 has-[>svg]:px-3",
                xs: "h-6 rounded-md px-2 py-0.5 has-[>svg]:px-1.5",
                sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
                lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
                icon: "size-9",
                iconSm: "size-8 px-1 py-0.5"
            }
        },
        defaultVariants: {
            variant: "default",
            size: "default"
        }
    }
);

const spinnerVariants = cva(
    "absolute inset-0 m-auto size-4 animate-spin rounded-full border-[2px] border-t-transparent",
    {
        variants: {
            variant: {
                default: "border-primary",
                destructive: "border-destructive",
                outline: "border-primary",
                secondary: "border-primary",
                ghost: "border-primary",
                link: "border-primary"
            }
        }
    }
);

function Button({
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    disabled = loading,
    children,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
        loading?: boolean;
    }) {
    const Comp = asChild ? Slot : "button";

    return (
        <Comp
            data-slot="button"
            className={cn(buttonVariants({ variant, size, className }), {
                relative: loading
            })}
            disabled={disabled}
            {...props}
        >
            {asChild ? (
                children
            ) : (
                <>
                    {children}
                    {loading && <div className={spinnerVariants({ variant })} />}
                </>
            )}
        </Comp>
    );
}

export { Button, buttonVariants };
