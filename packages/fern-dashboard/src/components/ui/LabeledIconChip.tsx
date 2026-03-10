import type { ReactNode } from "react";
import { cn } from "@/utils/utils";

interface LabeledIconChipProps {
    /** The label text displayed above the chip (e.g. "Postman collection"). */
    label: string;
    /** The icon rendered inside the chip, to the left of the text. */
    icon: ReactNode;
    /** The text displayed inside the chip (e.g. "speechify-api"). */
    text: string;
    /** Optional additional class name applied to the root container. */
    className?: string;
}

export function LabeledIconChip({ label, icon, text, className }: LabeledIconChipProps) {
    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
                <span className="flex shrink-0 items-center">{icon}</span>
                <span className="text-sm text-foreground">{text}</span>
            </div>
        </div>
    );
}
