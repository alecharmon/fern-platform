"use client";

import { BarChart } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface GroupByOption {
    label: string;
    value: number;
}

export interface GroupBySelectProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}

const GROUP_BY_OPTIONS: GroupByOption[] = [
    { label: "Day", value: 1 },
    { label: "Week", value: 7 },
    { label: "Month", value: 30 }
];

export default function GroupBySelect({ value, onChange, disabled = false }: GroupBySelectProps) {
    const selectedOption = GROUP_BY_OPTIONS.find((option) => option.value === value);

    const handleChange = (val: string) => {
        const option = GROUP_BY_OPTIONS.find(
            (opt) => opt.value.toString() === val || (val === "undefined" && opt.value === 1)
        );
        onChange(option?.value ?? 1);
    };

    return (
        <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-sm">Group by</span>
            <Select value={value.toString()} onValueChange={handleChange} disabled={disabled}>
                <SelectTrigger className="border-border min-w-[120px] gap-2 bg-white px-3 py-1.5 text-sm dark:bg-transparent">
                    <BarChart className="text-muted-foreground size-4" />
                    <SelectValue placeholder={selectedOption?.label ?? "Daily"} />
                </SelectTrigger>
                <SelectContent>
                    {GROUP_BY_OPTIONS.map((option) => (
                        <SelectItem key={option.value.toString() ?? "1"} value={option.value.toString()}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
