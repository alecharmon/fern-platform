"use client";

import { Calendar } from "lucide-react";
import { useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { TimeRange } from "./utils/get-request-params";

export interface TimeRangeOption {
    label: string;
    value: TimeRange;
}

export interface TimeRangeSelectProps {
    value?: TimeRange;
    onChange?: (value: TimeRange) => void;
    options: TimeRangeOption[];
}

export const TimeRangeSelect = ({ value, onChange, options }: TimeRangeSelectProps) => {
    const [selected, setSelected] = useState<TimeRange>(value || TimeRange.LAST_WEEK);

    const handleChange = (val: string) => {
        const newValue = val as TimeRange;
        setSelected(newValue);
        onChange?.(newValue);
    };

    return (
        <Select value={selected} onValueChange={handleChange}>
            <SelectTrigger className="border-input flex min-w-[140px] items-center gap-1 px-2">
                <Calendar className="h-4 w-4" />
                <SelectValue placeholder="Select Time Range" />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
