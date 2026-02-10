import { XIcon } from "lucide-react";
import { DashboardTooltip } from "@/components/editor/DashboardTooltip";
import { Button } from "@/components/ui/button";

export interface OverrideRowProps {
    label: string;
    description: string;
    onRemove: () => void;
    children: React.ReactNode;
}

export function OverrideRow({ label, description, onRemove, children }: OverrideRowProps) {
    return (
        <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium text-gray-1100">{label}</div>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{description}</div>
                </div>
                <DashboardTooltip content="Remove this override (use default)">
                    <Button variant="ghost" size="iconSm" onClick={onRemove} className="shrink-0">
                        <XIcon className="size-4" />
                        <span className="sr-only">Remove</span>
                    </Button>
                </DashboardTooltip>
            </div>
            <div className="mt-3">{children}</div>
        </div>
    );
}
