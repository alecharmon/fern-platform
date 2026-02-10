import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { ExportOptionKey } from "./types";

export interface SectionHeaderProps {
    title: string;
    description: React.ReactNode;
    addOverrideItems: { key: ExportOptionKey; label: string }[];
    onAddOverride: (key: ExportOptionKey) => void;
}

export function SectionHeader({ title, description, addOverrideItems, onAddOverride }: SectionHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <div className="text-sm font-semibold text-gray-1100">{title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{description}</div>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" disabled={addOverrideItems.length === 0}>
                        <PlusIcon className="size-4" />
                        Add override
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[16rem]">
                    {addOverrideItems.length === 0 ? (
                        <DropdownMenuItem disabled>No more options</DropdownMenuItem>
                    ) : (
                        addOverrideItems.map((item) => (
                            <DropdownMenuItem
                                key={item.key}
                                onClick={() => {
                                    onAddOverride(item.key);
                                }}
                            >
                                {item.label}
                            </DropdownMenuItem>
                        ))
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
