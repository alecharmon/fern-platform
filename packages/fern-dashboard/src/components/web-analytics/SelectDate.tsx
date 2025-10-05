"use client";

import React, { useCallback, useState } from "react";

import { CalendarIcon, MinusIcon, PlusIcon } from "lucide-react";

import type { DateRangeOptions } from "@/app/services/posthog/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRESET_RANGES = [
    {
        value: "7-days",
        label: "Last 7 days",
        dateRange: { type: "last_n_days" as const, days: 7 }
    },
    {
        value: "14-days",
        label: "Last 14 days",
        dateRange: { type: "last_n_days" as const, days: 14 }
    },
    {
        value: "30-days",
        label: "Last 30 days",
        dateRange: { type: "last_n_days" as const, days: 30 }
    },
    {
        value: "90-days",
        label: "Last 90 days",
        dateRange: { type: "last_n_days" as const, days: 90 }
    },
    {
        value: "180-days",
        label: "Last 180 days",
        dateRange: { type: "last_n_days" as const, days: 180 }
    }
] as const;

const DATE_UNITS = [
    { value: "days" as const, label: "days", max: 365 },
    { value: "weeks" as const, label: "weeks", max: 52 },
    { value: "months" as const, label: "months", max: 24 }
] as const;

type DateUnit = (typeof DATE_UNITS)[number]["value"];

interface SelectDateProps {
    value: DateRangeOptions;
    onChange: (value: DateRangeOptions) => void;
}

export default function SelectDate({ value, onChange }: SelectDateProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Always derive custom values from the current value prop
    const getCurrentCount = useCallback(() => {
        if (value.type === "last_n_days") return value.days;
        if (value.type === "last_n_weeks") return value.weeks;
        if (value.type === "last_n_months") return value.months;
        return 7;
    }, [value]);

    const getCurrentUnit = useCallback((): DateUnit => {
        if (value.type === "last_n_days") return "days";
        if (value.type === "last_n_weeks") return "weeks";
        if (value.type === "last_n_months") return "months";
        return "days";
    }, [value]);

    const [customCount, setCustomCount] = useState(getCurrentCount());
    const [customUnit, setCustomUnit] = useState<DateUnit>(getCurrentUnit());

    // Update custom values whenever value prop changes
    React.useEffect(() => {
        setCustomCount(getCurrentCount());
        setCustomUnit(getCurrentUnit());
    }, [value, getCurrentCount, getCurrentUnit]);

    // Find current preset
    const currentPreset = PRESET_RANGES.find(
        (preset) =>
            preset.dateRange &&
            preset.dateRange.type === value.type &&
            value.type === "last_n_days" &&
            preset.dateRange.days === value.days
    );

    // Display value
    const getDisplayValue = () => {
        if (currentPreset) return currentPreset.label;
        if (value.type === "last_n_days") return `Last ${value.days} days`;
        if (value.type === "last_n_weeks") return `Last ${value.weeks} weeks`;
        if (value.type === "last_n_months") return `Last ${value.months} months`;
        return "Select range";
    };

    const handlePresetChange = (preset: (typeof PRESET_RANGES)[number]) => {
        console.log("preset!!!", preset);
        if (preset.dateRange) {
            console.log("preset.dateRange!!!", preset.dateRange);
            onChange(preset.dateRange);
            setIsOpen(false);
        }
    };

    const updateCustomRange = (count: number, unit: DateUnit) => {
        let dateRange: DateRangeOptions;
        if (unit === "days") {
            dateRange = { type: "last_n_days", days: count };
        } else if (unit === "weeks") {
            dateRange = { type: "last_n_weeks", weeks: count };
        } else {
            dateRange = { type: "last_n_months", months: count };
        }
        onChange(dateRange);
    };

    const handleIncrement = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const maxValue = DATE_UNITS.find((u) => u.value === customUnit)?.max || 365;
        if (customCount < maxValue) {
            const newCount = customCount + 1;
            setCustomCount(newCount);
            updateCustomRange(newCount, customUnit);
        }
    };

    const handleDecrement = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (customCount > 1) {
            const newCount = customCount - 1;
            setCustomCount(newCount);
            updateCustomRange(newCount, customUnit);
        }
    };

    const handleUnitChange = (unit: DateUnit) => {
        const maxValue = DATE_UNITS.find((u) => u.value === unit)?.max || 365;
        const newCount = Math.min(customCount, maxValue);
        setCustomCount(newCount);
        setCustomUnit(unit);
        updateCustomRange(newCount, unit);
    };

    const displayValue = getDisplayValue();
    console.log("displayValue!!!", { displayValue, value });

    const handleSelectChange = (selectedValue: string) => {
        console.log("Selected value:", selectedValue);
        const preset = PRESET_RANGES.find((p) => p.value === selectedValue);
        if (preset) {
            handlePresetChange(preset);
        }
    };

    // Check if current value matches any preset
    const isCustomValue = !currentPreset;

    return (
        <Select
            open={isOpen}
            onOpenChange={setIsOpen}
            onValueChange={handleSelectChange}
            value={currentPreset?.value || "custom"}
        >
            <SelectTrigger className="border-border gap-2 bg-white px-3 py-1.5 text-sm dark:bg-transparent">
                <CalendarIcon className="text-muted-foreground size-4" />
                <SelectValue placeholder={displayValue}>{displayValue}</SelectValue>
            </SelectTrigger>
            <SelectContent>
                {PRESET_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                        {range.label}
                    </SelectItem>
                ))}

                <SelectSeparator />

                {/* Custom range controls - styled as a selectable item when active */}
                <div
                    className={`mx-1 rounded-sm px-2 py-1.5 ${isCustomValue ? "bg-accent" : "hover:bg-accent/50"} cursor-pointer transition-colors`}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">In the last</span>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={handleDecrement}
                            disabled={customCount <= 1}
                        >
                            <MinusIcon className="h-3 w-3" />
                        </Button>

                        <input
                            type="number"
                            value={customCount}
                            onChange={(e) => {
                                const value = parseInt(e.target.value) || 1;
                                const maxValue = DATE_UNITS.find((u) => u.value === customUnit)?.max || 365;
                                const clampedValue = Math.max(1, Math.min(value, maxValue));
                                setCustomCount(clampedValue);
                                updateCustomRange(clampedValue, customUnit);
                            }}
                            className="border-border focus:ring-ring w-12 rounded border bg-transparent px-0.5 py-0.5 text-center text-sm [appearance:textfield] focus:outline-none focus:ring-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            min={1}
                            max={DATE_UNITS.find((u) => u.value === customUnit)?.max || 365}
                        />

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={handleIncrement}
                            disabled={customCount >= (DATE_UNITS.find((u) => u.value === customUnit)?.max || 365)}
                        >
                            <PlusIcon className="h-3 w-3" />
                        </Button>

                        <Select value={customUnit} onValueChange={handleUnitChange}>
                            <SelectTrigger className="h-7 w-20 border px-2 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DATE_UNITS.map((unit) => (
                                    <SelectItem key={unit.value} value={unit.value}>
                                        {unit.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </SelectContent>
        </Select>
    );
}
