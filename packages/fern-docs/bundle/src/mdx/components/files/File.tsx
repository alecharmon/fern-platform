import { cn } from "@fern-docs/components/cn";
import { FileText } from "lucide-react";

export interface FileProps {
    name: string;
    className?: string;
    href?: string;
}

export function File({ name, className, href }: FileProps) {
    const content = (
        <>
            <FileText className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
            <span className={cn("text-default", href && "hover:underline")}>{name}</span>
        </>
    );

    if (href) {
        return (
            <a
                href={href}
                className={cn(
                    "flex items-center gap-2 p-1 rounded-3/2 transition-colors hover:bg-(color:--grayscale-a4) hover:transition-none",
                    className
                )}
            >
                {content}
            </a>
        );
    }

    return (
        <div
            className={cn(
                "flex items-center gap-2 p-1 rounded-3/2 transition-colors hover:bg-(color:--grayscale-a4) hover:transition-none",
                className
            )}
        >
            {content}
        </div>
    );
}
