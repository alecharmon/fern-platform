"use client";

import { useTheme } from "next-themes";

import { Monitor, Moon, Sun } from "lucide-react";

import { useMounted } from "@fern-ui/react-commons";

import { Button, FernDropdown } from "..";

const themeSwitchOptions = [
    { type: "value", value: "light", label: "Light", icon: <Sun /> },
    { type: "value", value: "dark", label: "Dark", icon: <Moon /> },
    { type: "value", value: "system", label: "System", icon: <Monitor /> }
] as const;

export function ThemeSwitch({
    className,
    variant = "outline",
    size = "default",
    iconOnly = false,
    disabled = false
}: {
    className?: string;
    variant?: "outline" | "ghost";
    size?: "sm" | "default";
    iconOnly?: boolean;
    disabled?: boolean;
}) {
    const { setTheme, theme = "system", forcedTheme } = useTheme();
    const mounted = useMounted();
    const selectedOption = themeSwitchOptions.find((option) => option.value === (mounted ? theme : "light"));
    if (forcedTheme) {
        return null;
    }
    return (
        <FernDropdown
            className={className}
            options={themeSwitchOptions}
            onValueChange={setTheme}
            value={selectedOption?.value}
        >
            <Button
                variant={variant}
                size={iconOnly ? (size === "default" ? "icon" : "iconSm") : size}
                disabled={disabled}
            >
                {selectedOption?.icon}
                {!iconOnly && selectedOption?.label}
            </Button>
        </FernDropdown>
    );
}
