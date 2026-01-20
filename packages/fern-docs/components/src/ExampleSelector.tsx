import { ChevronDown } from "lucide-react";
import type { ReactElement } from "react";
import { cn } from "./cn";
import { FernButton, FernButtonGroup } from "./FernButton";
import { FernDropdown } from "./FernDropdown";

export interface ExampleSelectorOption {
    key: string;
    label: string;
    title?: string;
}

export interface ExampleSelectorProps {
    options: ExampleSelectorOption[];
    selectedKey: string | undefined;
    onSelect: (key: string) => void;
    lang: string;
    totalLabelLengthOverride?: number;
    placeholder?: string;
    forceDropdown?: boolean;
    className?: string;
}

export function ExampleSelector({
    options,
    selectedKey,
    onSelect,
    lang,
    totalLabelLengthOverride,
    placeholder,
    forceDropdown,
    className
}: ExampleSelectorProps): ReactElement<any> | null {
    if (options.length === 0) {
        return null;
    }

    // If the selectedKey doesn't match any option, default to the first option for display
    const effectiveSelectedKey = options.some((opt) => opt.key === selectedKey) ? selectedKey : options[0]?.key;
    const selectedOption = options.find((opt) => opt.key === effectiveSelectedKey);
    const totalLabelLength = totalLabelLengthOverride ?? options.map((opt) => opt.label).join("").length;
    const shouldUseDropdown = forceDropdown === true || options.length >= 8 || totalLabelLength >= 80;
    const hasSelection = effectiveSelectedKey !== undefined && selectedOption !== undefined;

    if (shouldUseDropdown) {
        return (
            <div className={cn("w-full min-w-0", className)}>
                <FernDropdown
                    options={options.map((opt) => ({
                        type: "value",
                        value: opt.key,
                        label: opt.label,
                        labelClassName: "truncate max-w-md"
                    }))}
                    onValueChange={(value) => {
                        onSelect(value);
                    }}
                    value={effectiveSelectedKey}
                    lang={lang}
                >
                    <FernButton
                        className="w-full min-w-0 truncate text-left"
                        size="normal"
                        variant="outlined"
                        text={hasSelection ? selectedOption.label : placeholder}
                        rightIcon={<ChevronDown className="size-icon flex-shrink-0" />}
                    />
                </FernDropdown>
            </div>
        );
    }

    return (
        <div className={cn("w-full min-w-0", className)}>
            <FernButtonGroup className="w-full min-w-0">
                {options.map((opt) => {
                    const isSelected = opt.key === effectiveSelectedKey;
                    return (
                        <FernButton
                            key={opt.key}
                            rounded={true}
                            onClick={() => {
                                onSelect(opt.key);
                            }}
                            className={
                                "min-w-0 flex-1 truncate" + (isSelected ? " ring-primary-500" : " ring-transparent")
                            }
                            mono
                            size="small"
                            variant="outlined"
                            intent={isSelected ? "primary" : "none"}
                        >
                            <span className="block w-full truncate" title={opt.title ?? opt.label}>
                                {opt.label}
                            </span>
                        </FernButton>
                    );
                })}
            </FernButtonGroup>
        </div>
    );
}
