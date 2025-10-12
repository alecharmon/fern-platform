"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/utils/utils";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={cn(
                // animation
                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                // backdrop + positioning
                "backdrop-blur-xs fixed inset-0 z-50 bg-gray-100/10 dark:bg-black/10",
                className
            )}
            {...props}
        />
    );
}

function DialogContent({
    className,
    children,
    persistent = false,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
    persistent?: boolean;
}) {
    return (
        <DialogPortal data-slot="dialog-portal">
            <DialogOverlay />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                className={cn(
                    // color + border
                    "bg-background dark:bg-background border-border border",
                    // state animations
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
                    // base layout + size
                    "md:min-h-auto fixed bottom-0 z-50 flex min-h-[65%] w-full flex-col overflow-hidden rounded-t-lg pt-6 shadow-lg duration-200",
                    // responsive positioning
                    "md:bottom-auto md:left-[50%] md:top-[50%] md:max-w-lg md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-lg",
                    className
                )}
                {...props}
            >
                {children}
                {/* if dialog is persistent, don't show close button so that we force the user to take action in order to close the dialog */}
                {!persistent && (
                    <DialogPrimitive.Close
                        className={cn(
                            // positioning
                            "absolute right-4 top-4",
                            // shape + opacity
                            "rounded-xs opacity-70 transition-opacity hover:opacity-100",
                            // state appearance
                            "data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
                            // focus ring
                            "ring-offset-background focus:outline-hidden focus:ring-ring focus:ring-2 focus:ring-offset-2",
                            // disabled behavior
                            "disabled:pointer-events-none",
                            // icon sizing defaults
                            "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                        )}
                    >
                        <XIcon />
                        <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="dialog-header" className={cn("flex flex-col gap-2 px-6 text-left", className)} {...props} />;
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("flex flex-col gap-2 p-6", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                "border-border mt-auto flex flex-row justify-between gap-2 border-t bg-gray-200 p-6",
                className
            )}
            {...props}
        />
    );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn("text-xl font-semibold leading-none", className)}
            {...props}
        />
    );
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn("text-muted-foreground text-sm", className)}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
    DialogBody
};
