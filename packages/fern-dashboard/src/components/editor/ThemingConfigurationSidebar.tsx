"use client";

import { useNavigation } from "@fern-docs/components/navigation";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChromePicker } from "react-color";
import { useThemingPanel } from "@/providers/ThemingPanelProvider";
import { cn } from "@/utils/utils";
import {
    COLOR_FIELDS,
    EMPTY_THEME_COLORS,
    findDocsYmlFilePath,
    parseColorsFromYml,
    type ThemeColors,
    updateColorsInYml
} from "./docs-yml-colors";

function InlineColorSwatch({
    color,
    label,
    onChange
}: {
    color: string | null;
    label: string;
    onChange: (color: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={ref}>
            <button type="button" className="flex items-center gap-1.5" onClick={() => setIsOpen(!isOpen)}>
                <div
                    className="size-6 rounded border border-gray-500"
                    style={{ backgroundColor: color ?? "transparent" }}
                />
                <span className="text-xs text-gray-900">{label}</span>
            </button>
            {isOpen && (
                <div className="absolute top-8 right-0 z-50">
                    <ChromePicker color={color ?? "#000000"} onChange={(c) => onChange(c.hex)} disableAlpha />
                </div>
            )}
        </div>
    );
}

export function ThemingConfigurationSidebar() {
    const { getDocsYmlContent, updateDocsYmlContent } = useNavigation();
    const { setColorOverrides } = useThemingPanel();
    const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(true);

    const docsYmlFilePath = useMemo(() => findDocsYmlFilePath(getDocsYmlContent), [getDocsYmlContent]);
    const docsYmlContent = docsYmlFilePath ? getDocsYmlContent(docsYmlFilePath) : null;

    const initialColors = useMemo(() => {
        if (!docsYmlContent) {
            return { ...EMPTY_THEME_COLORS };
        }
        return parseColorsFromYml(docsYmlContent);
    }, [docsYmlContent]);

    const [colors, setColors] = useState<ThemeColors>(initialColors);

    useEffect(() => {
        setColors(initialColors);
        setColorOverrides(initialColors);
    }, [initialColors, setColorOverrides]);

    const handleColorChange = useCallback(
        (key: keyof ThemeColors, variant: "dark" | "light", value: string) => {
            setColors((prev) => {
                const updated = {
                    ...prev,
                    [key]: { ...prev[key], [variant]: value }
                };

                if (docsYmlFilePath && docsYmlContent) {
                    const updatedYml = updateColorsInYml(docsYmlContent, updated);
                    updateDocsYmlContent(docsYmlFilePath, updatedYml);
                }

                setColorOverrides(updated);

                return updated;
            });
        },
        [docsYmlFilePath, docsYmlContent, updateDocsYmlContent, setColorOverrides]
    );

    return (
        <div className="flex-1 overflow-y-auto p-4">
            <button
                type="button"
                className="flex w-full items-center gap-1.5 pb-3"
                onClick={() => setIsColorPaletteOpen(!isColorPaletteOpen)}
            >
                <ChevronDown
                    className={cn("size-4 text-gray-900 transition-transform", !isColorPaletteOpen && "-rotate-90")}
                />
                <span className="text-sm font-medium">Color palette</span>
            </button>

            {isColorPaletteOpen && (
                <div className="flex flex-col gap-3 pl-1">
                    {COLOR_FIELDS.map((field) => (
                        <div key={field.key} className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{field.label}</span>
                            <div className="flex items-center gap-3">
                                <InlineColorSwatch
                                    color={colors[field.key].light}
                                    label="light"
                                    onChange={(c) => handleColorChange(field.key, "light", c)}
                                />
                                <InlineColorSwatch
                                    color={colors[field.key].dark}
                                    label="dark"
                                    onChange={(c) => handleColorChange(field.key, "dark", c)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
