"use client";

import type * as React from "react";

import { cn } from "@/utils/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
    return (
        <div data-slot="table-container" className="relative w-full overflow-x-auto">
            <table
                data-slot="table"
                className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)}
                {...props}
            />
        </div>
    );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
    return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
    return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
    return (
        <tfoot
            data-slot="table-footer"
            className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)}
            {...props}
        />
    );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
    return (
        <tr
            data-slot="table-row"
            className={cn(
                "overflow-hidden rounded-md border-b transition-colors",
                // stack cells vertically on mobile, revert to table layout on md+
                "block md:table-row",
                "[&>td:not([data-desktop-only])]:block md:[&>td:not([data-mobile-only])]:table-cell",
                // apply bg to cells so rounding is visible
                "hover:[&>td]:bg-muted data-[state=selected]:[&>td]:bg-muted",
                // round outer cell corners
                "md:[&>td:first-child]:rounded-l-md md:[&>td:last-child]:rounded-r-md",
                // add transition to left/right padding on first/last cell
                "md:[&>td:first-child]:transition-[padding,background-color] md:[&>td:last-child]:transition-[padding,background-color]",
                // no left/right padding on first/last cell
                "md:[&>td:first-child]:pl-0 md:[&>td:last-child]:pr-0",
                // add left/right padding to first/last cell on hover
                "md:hover:[&>td:first-child]:pl-2 md:hover:[&>td:last-child]:pr-2",
                // maintain padding on selected state
                "md:data-[state=selected]:[&>td:first-child]:pl-2 md:data-[state=selected]:[&>td:last-child]:pr-2",
                "data-[state=selected]:hover:[&>td]:bg-muted",
                className
            )}
            {...props}
        />
    );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
    return (
        <th
            data-slot="table-head"
            className={cn(
                "text-foreground h-10 whitespace-nowrap px-2 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                className
            )}
            {...props}
        />
    );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                // left aligned and allow wrapping on mobile, keep no-wrap on md+
                "text-gray-1100 whitespace-normal p-2 text-left align-middle md:whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                className
            )}
            {...props}
        />
    );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
    return (
        <caption data-slot="table-caption" className={cn("text-muted-foreground mt-4 text-sm", className)} {...props} />
    );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
