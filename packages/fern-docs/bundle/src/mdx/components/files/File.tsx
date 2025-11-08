import { cn } from "@fern-docs/components/cn";
import { FileText } from "lucide-react";

export interface FileProps {
    name: string;
    className?: string;
}

export function File({ name, className }: FileProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-2 p-1 rounded-3/2 transition-colors hover:bg-(color:--grayscale-a4) hover:transition-none",
                className
            )}
        >
            <FileText className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
            <span className="text-default">{name}</span>
        </div>
    );
}
