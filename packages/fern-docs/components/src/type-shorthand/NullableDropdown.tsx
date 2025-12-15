"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../cn";
import { FernDropdown } from "../FernDropdown";

interface NullableDropdownProps {
    options: string[];
    onChange: (value: unknown) => void;
    lang: string;
}

export function NullableDropdown({ options, onChange, lang }: NullableDropdownProps) {
    const [selectedOption, setSelectedOption] = useState(options[0] || "");

    const handleValueChange = (value: string) => {
        if (value !== selectedOption) {
            setSelectedOption(value);
            onChange(value === "null" ? null : value);
        }
    };

    return (
        <FernDropdown
            options={options.map((option) => ({
                type: "value" as const,
                value: option,
                label: option
            }))}
            value={selectedOption}
            onValueChange={handleValueChange}
            triggerAsChild={false}
            lang={lang}
        >
            <div className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-gray-100">
                <span>
                    {options.map((option, index) => (
                        <span key={option}>
                            {index > 0 && " or "}
                            <span className={cn(option === selectedOption && "text-(color:--accent)")}>{option}</span>
                        </span>
                    ))}
                </span>
                <ChevronDown className="h-3 w-3" />
            </div>
        </FernDropdown>
    );
}
