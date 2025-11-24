"use client";

import { useEffect, useRef, useState } from "react";
import { ChromePicker } from "react-color";

import { Label } from "@/components/ui/label";
import { cn } from "@/utils/utils";

interface ColorPickerProps {
    label: string;
    color: string | null;
    onColorChange: (color: string) => void;
}

export default function ColorPicker({ label, color, onColorChange }: ColorPickerProps) {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [currentColor, setCurrentColor] = useState(color || "#1E1F24");
    const pickerRef = useRef<HTMLDivElement>(null);

    // Sync internal state with prop changes
    useEffect(() => {
        if (color) {
            setCurrentColor(color);
        }
    }, [color]);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };

        if (isPickerOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isPickerOpen]);

    const handleColorChange = (newColor: any) => {
        const hexColor = newColor.hex;
        setCurrentColor(hexColor);
        onColorChange(hexColor);
    };

    return (
        <div className="flex flex-col gap-2">
            <div>
                <Label className="text-gray-1200 dark:text-gray-1100 text-sm font-normal">{label}</Label>
            </div>

            <div className="relative flex items-center gap-4">
                {/* Color preview box */}
                <div
                    className={cn(
                        "flex h-20 min-w-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-gray-500 bg-transparent p-3 transition-all duration-300 hover:border-gray-700 hover:bg-opacity-100"
                    )}
                    onClick={() => setIsPickerOpen(!isPickerOpen)}
                >
                    <div className="h-full w-full rounded-lg" style={{ backgroundColor: currentColor }} />
                </div>

                {/* Color value display */}
                <div className="flex flex-col gap-2">
                    <div
                        className="text-gray-1200 cursor-pointer font-mono text-sm"
                        onClick={() => setIsPickerOpen(!isPickerOpen)}
                    >
                        {currentColor.toUpperCase()}
                    </div>
                    {!color && (
                        <p
                            className="text-gray-1000 cursor-pointer text-xs font-light"
                            onClick={() => setIsPickerOpen(!isPickerOpen)}
                        >
                            Pick a color
                        </p>
                    )}
                </div>

                {/* Color picker popover */}
                {isPickerOpen && (
                    <div ref={pickerRef} className="absolute bottom-24 left-0 z-50" style={{ zIndex: 1000 }}>
                        <ChromePicker color={currentColor} onChange={handleColorChange} disableAlpha />
                    </div>
                )}
            </div>
        </div>
    );
}
