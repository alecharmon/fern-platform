"use client";

import * as Popover from "@radix-ui/react-popover";
import { Info, Trash2, TriangleAlert } from "lucide-react";
import type React from "react";
import { createContext, type ReactNode, type RefObject, useContext, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/utils/utils";
import { DashboardTooltip } from "../DashboardTooltip";

import type { AttributeValue } from "../editor-mdx-renderer/types";
import {
    type AttributeConfig,
    type AttributeValues,
    CheckboxControl,
    type Control,
    IntegerInputControl,
    SelectControl,
    TextInputControl
} from "./controls";
import { useEditorComponent } from "./EditorComponentContext";
import EllipsisButton from "./EllipsisButton";
import "./controls.scss";

// Context types with generics
interface EditorComponentPopoverContextValue<T extends AttributeConfig = AttributeConfig> {
    attributes: T;
    values: AttributeValues<T>;
    setValues: React.Dispatch<React.SetStateAction<AttributeValues<T>>>;
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isWithinThreshold: boolean;
    setIsWithinThreshold: React.Dispatch<React.SetStateAction<boolean>>;
    buttonAlwaysVisible: boolean;
}

const EditorComponentPopoverContext = createContext<EditorComponentPopoverContextValue<any> | null>(null);

export function useEditorComponentPopover<T extends AttributeConfig>() {
    const context = useContext(EditorComponentPopoverContext) as EditorComponentPopoverContextValue<T> | null;
    if (!context) {
        throw new Error("useEditorComponentPopover must be used within EditorComponentPopoverProvider");
    }
    return context;
}

// Provider component
export function EditorComponentPopoverProvider<T extends AttributeConfig>({
    attributes,
    children,
    targetRef,
    hoverSlopThreshold = 0, // Threshold distance in pixels for showing the popover button (0 = all hovers must be within the element itself)
    openPopoverIfNewlyCreated = true,
    buttonAlwaysVisible = false
}: {
    attributes: T;
    children: ReactNode;
    targetRef?: RefObject<HTMLElement | null>;
    hoverSlopThreshold?: number;
    openPopoverIfNewlyCreated?: boolean;
    buttonAlwaysVisible?: boolean;
}) {
    const { newlyCreated } = useEditorComponent();
    const [isOpen, setIsOpen] = useState(Boolean(newlyCreated && openPopoverIfNewlyCreated));
    const [isWithinThreshold, setIsWithinThreshold] = useState(false);

    // Initialize values with defaults from controls
    const getInitialValues = (): AttributeValues<T> => {
        const values = {} as AttributeValues<T>;
        (Object.entries(attributes) as [keyof T, T[keyof T]][]).forEach(([key, control]) => {
            values[key] = control.getDefaultValue() as AttributeValues<T>[keyof T];
        });
        return values;
    };

    const [values, setValues] = useState<AttributeValues<T>>(getInitialValues);

    // Add mouse move listener to track distance from target
    // biome-ignore lint/correctness/useExhaustiveDependencies: TODO fix this
    useEffect(() => {
        const element = targetRef?.current;
        if (!element) {
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            const rect = element.getBoundingClientRect();

            // Calculate distance to nearest edge or corner of the element
            let minDistance = Infinity;

            // Check if mouse is inside the element
            const isInsideElement =
                e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

            if (isInsideElement) {
                // If inside, distance is 0
                minDistance = 0;
            } else {
                // Calculate distance to the nearest point on the rectangle
                const nearestX = Math.max(rect.left, Math.min(e.clientX, rect.right));
                const nearestY = Math.max(rect.top, Math.min(e.clientY, rect.bottom));

                // Calculate distance from mouse to nearest point
                minDistance = Math.sqrt(Math.pow(e.clientX - nearestX, 2) + Math.pow(e.clientY - nearestY, 2));
            }

            setIsWithinThreshold(minDistance <= hoverSlopThreshold);
        };

        // Add mousemove listener to document
        document.addEventListener("mousemove", handleMouseMove);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
        };
        // (cberry): this to fix hot reloading
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetRef, targetRef?.current]);

    return (
        <EditorComponentPopoverContext.Provider
            value={{
                attributes,
                values,
                setValues,
                isOpen,
                setIsOpen,
                isWithinThreshold,
                setIsWithinThreshold,
                buttonAlwaysVisible
            }}
        >
            {children}
        </EditorComponentPopoverContext.Provider>
    );
}

function UnsupportedValue({ name, message }: { name: string; message?: string }) {
    return (
        <div className="space-y-1.5">
            <label className="fern-control-label text-sm">{name.replace(/([A-Z])/g, " $1").trim()}</label>
            <div className="border-destructive/20 bg-destructive/5 flex items-center space-x-2 rounded-md border px-3 py-2 text-sm">
                <TriangleAlert className="text-destructive h-4 w-4" />
                {message && <span className="text-muted-foreground">{message}</span>}
            </div>
        </div>
    );
}

// Control components
function SelectControlComponent({
    name,
    control,
    value,
    onChange
}: {
    name: string;
    control: SelectControl;
    value: AttributeValue;
    onChange: (value: AttributeValue) => void;
}) {
    if (value.type !== "string") {
        return <UnsupportedValue name={name} />;
    }
    return (
        <div className="space-y-1.5">
            <label className="fern-control-label text-sm">{name.replace(/([A-Z])/g, " $1").trim()}</label>
            <Select
                value={value.value}
                onValueChange={(v) =>
                    onChange({
                        type: "string",
                        value: v
                    })
                }
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Select ${name}`} />
                </SelectTrigger>
                <SelectContent className="border-border">
                    {control.options.map((option: string) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
function TextInputControlComponent({
    name,
    control,
    value,
    onChange
}: {
    name: string;
    control: TextInputControl;
    value: AttributeValue;
    onChange: (value: AttributeValue) => void;
}) {
    if (value.type !== "string") {
        return <UnsupportedValue name={name} />;
    }
    const displayLabel = control.label || name.replace(/([A-Z])/g, " $1").trim();
    return (
        <div className="space-y-1.5">
            <label className="fern-control-label text-sm">{displayLabel}</label>
            <Input
                type="text"
                value={value.value}
                onChange={(e) =>
                    onChange({
                        type: "string",
                        value: e.target.value
                    })
                }
                placeholder={control.placeholder}
                className="w-full"
            />
        </div>
    );
}

function IntegerInputControlComponent({
    name,
    control,
    value,
    onChange
}: {
    name: string;
    control: IntegerInputControl;
    value: AttributeValue;
    onChange: (value: AttributeValue) => void;
}) {
    if (value.type !== "value") {
        return <UnsupportedValue name={name} />;
    }

    // Parse the current value as an integer
    const currentValue = parseInt(value.rawStringValue, 10);
    const displayValue = isNaN(currentValue) ? "" : currentValue.toString();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;

        // Allow empty string
        if (inputValue === "") {
            onChange({
                type: "value",
                rawStringValue: ""
            });
            return;
        }

        // Allow negative sign at the beginning
        if (inputValue === "-") {
            onChange({
                type: "value",
                rawStringValue: "-"
            });
            return;
        }

        // Parse as integer
        const parsed = parseInt(inputValue, 10);

        // Only update if it's a valid integer
        if (!isNaN(parsed)) {
            // Check min/max constraints
            let validValue = parsed;
            if (control.min !== undefined && parsed < control.min) {
                validValue = control.min;
            }
            if (control.max !== undefined && parsed > control.max) {
                validValue = control.max;
            }

            onChange({
                type: "value",
                rawStringValue: validValue.toString()
            });
        }
    };

    const displayLabel = control.label || name.replace(/([A-Z])/g, " $1").trim();
    return (
        <div className="space-y-1.5">
            <label className="fern-control-label text-sm">{displayLabel}</label>
            <Input
                type="number"
                value={displayValue}
                onChange={handleChange}
                placeholder={control.placeholder}
                min={control.min}
                max={control.max}
                step="1"
                className="w-full"
            />
        </div>
    );
}

function CheckboxControlComponent({
    name,
    control,
    value,
    onChange
}: {
    name: string;
    control: CheckboxControl;
    value: AttributeValue;
    onChange: (value: AttributeValue) => void;
}) {
    if (value.type !== "value") {
        return <UnsupportedValue name={name} />;
    }

    // Parse the current value as a boolean
    // Empty string means undefined/unset, treat as false
    const currentValue = value.rawStringValue !== "" && value.rawStringValue.toLowerCase() === "true";

    const handleChange = (checked: boolean) => {
        onChange({
            type: "value",
            rawStringValue: checked ? "true" : ""
        });
    };

    return (
        <div className="flex items-center gap-2 py-2">
            <Switch id={name} checked={currentValue} onCheckedChange={handleChange} />
            {control.label && (
                <div className="flex items-center gap-1.5">
                    <label
                        htmlFor={name}
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        {control.label}
                    </label>
                    {control.tooltip && (
                        <DashboardTooltip content={control.tooltip}>
                            <button type="button" className="text-muted-foreground hover:text-foreground">
                                <Info className="h-3.5 w-3.5" />
                            </button>
                        </DashboardTooltip>
                    )}
                </div>
            )}
        </div>
    );
}

// Control renderer component
function ControlRenderer({
    name,
    control,
    value,
    onChange
}: {
    name: string;
    control: Control;
    value: AttributeValue;
    onChange: (value: AttributeValue) => void;
}) {
    if (control instanceof SelectControl) {
        return <SelectControlComponent name={name} control={control} value={value} onChange={onChange} />;
    }

    if (control instanceof TextInputControl) {
        return <TextInputControlComponent name={name} control={control} value={value} onChange={onChange} />;
    }

    if (control instanceof IntegerInputControl) {
        return <IntegerInputControlComponent name={name} control={control} value={value} onChange={onChange} />;
    }

    if (control instanceof CheckboxControl) {
        return <CheckboxControlComponent name={name} control={control} value={value} onChange={onChange} />;
    }

    return null;
}

// Button component
export function EditorComponentPopoverButton<T extends AttributeConfig>({
    className,
    disableDelete,
    componentName
}: {
    componentName?: string;
    className?: string;
    disableDelete?: boolean;
}) {
    const { attributes, values, setValues, isOpen, setIsOpen, isWithinThreshold } = useEditorComponentPopover<T>();
    const [tempValues, setTempValues] = useState<AttributeValues<T>>(values);

    const { updateKeyedAttributes, deleteSelf } = useEditorComponent();

    const performSave = () => {
        setValues(tempValues);
        updateKeyedAttributes((current) => {
            return filterEmptyValues({
                ...current,
                ...tempValues
            });
        });
    };

    const handleSavePressed = () => {
        performSave();
        setIsOpen(false);
    };

    const handleOpen = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            // Reset temp values when opening
            setTempValues(values);
        }
    };

    const handleCancelPressed = () => {
        // Reset temp values to original values and close
        setTempValues(values);
        setIsOpen(false);
    };

    const handleDeletePressed = () => {
        deleteSelf();
        setIsOpen(false);
    };

    const hasAttributes = Object.keys(attributes).length > 0;
    const showDividerUnderComponentName = componentName && hasAttributes;

    return (
        <Popover.Root
            open={isOpen}
            onOpenChange={(open) => {
                handleOpen(open);
                if (!open) {
                    performSave();
                }
            }}
        >
            <Popover.Trigger asChild>
                <EllipsisButton className={cn(!isWithinThreshold && "opacity-0", className)} />
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className={cn(
                        "bg-popover text-popover-foreground border-border-default z-50 flex max-h-[400px] w-80 flex-col rounded-lg border p-0 shadow-md",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "data-[side=bottom]:slide-in-from-top-2",
                        "data-[side=left]:slide-in-from-right-2",
                        "data-[side=right]:slide-in-from-left-2",
                        "data-[side=top]:slide-in-from-bottom-2"
                    )}
                    sideOffset={5}
                >
                    {componentName && <div className="editor-component-title p-3 pb-1.5">{componentName}</div>}
                    {showDividerUnderComponentName && <div className="border-border-default border-t" />}
                    {hasAttributes && (
                        <div className="flex-1 space-y-3 overflow-y-auto p-3 pt-2">
                            {(Object.entries(attributes) as [keyof T, T[keyof T]][]).map(([name, control]) => (
                                <ControlRenderer
                                    key={name as string}
                                    name={name as string}
                                    control={control}
                                    value={tempValues[name]}
                                    onChange={(value) => setTempValues((prev) => ({ ...prev, [name]: value }))}
                                />
                            ))}
                        </div>
                    )}

                    <div
                        className={cn(
                            "bg-popover border-border-default flex shrink-0 justify-between rounded-b-lg border-t p-2",
                            {
                                "justify-end": disableDelete
                            }
                        )}
                    >
                        {!disableDelete && (
                            <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={handleDeletePressed}
                                className="hover:text-red-600"
                            >
                                <Trash2 />
                            </Button>
                        )}

                        <div className="flex gap-2 self-end">
                            <Button variant="ghost" size="sm" onClick={handleCancelPressed}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSavePressed}>
                                Save
                            </Button>
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

export function filterEmptyValues(obj: Record<string, AttributeValue>): Record<string, AttributeValue> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) =>
            value.type === "string" ? value.value !== "" : value.rawStringValue !== ""
        )
    );
}
