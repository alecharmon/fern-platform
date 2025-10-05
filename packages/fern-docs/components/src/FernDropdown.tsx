"use client";

import {
    type ComponentProps,
    type MouseEventHandler,
    type PropsWithChildren,
    type ReactElement,
    type ReactNode,
    cloneElement,
    forwardRef,
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Info } from "lucide-react";

import { useResizeObserver } from "@fern-ui/react-commons";

import { FernProductItem } from "./FernProductItem";
import { FernScrollArea } from "./FernScrollArea";
import { FernTooltip, FernTooltipProvider } from "./FernTooltip";
import { cn } from "./cn";

export declare namespace FernDropdown {
    export interface AuthOption {
        type: "auth";
        key: string;
        value: string;
        selected: boolean;
    }

    export interface ProductOption {
        type: "product";
        id: string;
        title: string;
        subtitle?: string;
        children?: ReactNode | ((active: boolean) => ReactNode);
        value: string;
        icon?: ReactNode;
        image?: ReactNode;
        className?: string;
        labelClassName?: string;
        href?: string;
        dense?: boolean;
    }

    export interface ValueOption {
        type: "value";
        label?: ReactNode;
        helperText?: ReactNode; // not used in multi-select
        children?: ReactNode | ((active: boolean) => ReactNode);
        value: string;
        icon?: ReactNode;
        rightElement?: ReactNode;
        tooltip?: ReactNode;
        className?: string;
        labelClassName?: string;
        href?: string;
    }
    export interface SeparatorOption {
        type: "separator";
    }

    export type PageActionOption = ValueOption | SeparatorOption;

    export type Option = ProductOption | ValueOption | SeparatorOption | AuthOption;

    export interface Props {
        className?: string;
        options: readonly Option[];
        onValueChange?: (value: string) => void;
        value?: string | string[]; // value must be an array to set as multi-select
        onOpen?: () => void;
        usePortal?: boolean;
        side?: "top" | "right" | "bottom" | "left";
        align?: "start" | "center" | "end";
        defaultOpen?: boolean;
        dropdownMenuElement?: ReactElement;
        container?: HTMLElement; // portal container
        onClick?: MouseEventHandler<HTMLDivElement> | undefined;
        contentProps?: ComponentProps<typeof DropdownMenu.Content> & {
            "data-testid"?: string;
        };
        triggerAsChild?: boolean;
        radioGroupProps?: ComponentProps<typeof DropdownMenu.RadioGroup>;
    }
}

export const FernDropdown = forwardRef<HTMLButtonElement, PropsWithChildren<FernDropdown.Props>>(
    (
        {
            className,
            options,
            onValueChange,
            value,
            children,
            onOpen,
            usePortal = true,
            side,
            align,
            defaultOpen = false,
            dropdownMenuElement,
            container,
            onClick,
            contentProps,
            triggerAsChild = true,
            radioGroupProps = {}
        },
        ref
    ): ReactElement => {
        const [isOpen, setOpen] = useState(defaultOpen);
        const handleOpenChange = useCallback(
            (toOpen: boolean) => {
                setOpen(toOpen);
                if (toOpen && onOpen != null) {
                    onOpen();
                }
            },
            [onOpen]
        );

        const isValueSelected = useCallback(
            (optionValue: string) => {
                return Array.isArray(value) ? (value?.includes(optionValue) ?? false) : value === optionValue;
            },
            [value]
        );
        const renderDropdownContent = () => (
            <DropdownMenu.Content
                sideOffset={4}
                collisionPadding={4}
                side={side}
                align={align}
                hideWhenDetached
                {...contentProps}
                className={cn("fern-dropdown [&_svg]:size-icon", contentProps?.className)}
            >
                <FernTooltipProvider>
                    <FernScrollArea rootClassName="min-h-0 shrink" className="p-1" scrollbars="vertical">
                        {Array.isArray(value) ? (
                            <div onClick={onClick}>
                                {options.map((option, idx) =>
                                    option.type === "value" ? (
                                        <FernDropdownItemMultiSelect
                                            key={option.value}
                                            option={option}
                                            isSelected={isValueSelected(option.value)}
                                            onToggle={
                                                onValueChange ??
                                                (() => {
                                                    void 0;
                                                })
                                            }
                                            dropdownMenuElement={dropdownMenuElement}
                                            container={container}
                                        />
                                    ) : option.type === "separator" ? (
                                        <DropdownMenu.Separator
                                            key={idx}
                                            className="bg-border-default mx-2 my-1 h-px"
                                        />
                                    ) : null
                                )}
                            </div>
                        ) : (
                            <DropdownMenu.RadioGroup
                                value={value}
                                onValueChange={onValueChange}
                                onClick={onClick}
                                {...radioGroupProps}
                            >
                                {options.map((option, idx) =>
                                    option.type === "value" ? (
                                        <FernDropdownItemValue
                                            key={option.value}
                                            option={option}
                                            value={value}
                                            dropdownMenuElement={dropdownMenuElement}
                                            container={container}
                                        />
                                    ) : option.type === "product" ? (
                                        <FernProductItem key={option.id} option={option} dense={option.dense} />
                                    ) : option.type === "auth" ? (
                                        <FernDropdownItemAuth key={option.key} option={option} />
                                    ) : option.type === "separator" ? (
                                        <DropdownMenu.Separator
                                            key={idx}
                                            className="bg-border-default mx-2 my-1 h-px"
                                        />
                                    ) : (
                                        <DropdownMenu.Separator
                                            key={idx}
                                            className="bg-border-default mx-2 my-1 h-px"
                                        />
                                    )
                                )}
                            </DropdownMenu.RadioGroup>
                        )}
                    </FernScrollArea>
                </FernTooltipProvider>
            </DropdownMenu.Content>
        );

        return (
            <DropdownMenu.Root onOpenChange={handleOpenChange} open={isOpen} modal={false} defaultOpen={defaultOpen}>
                <DropdownMenu.Trigger asChild={triggerAsChild} ref={ref} className={className}>
                    {children}
                </DropdownMenu.Trigger>
                {usePortal ? (
                    <DropdownMenu.Portal container={container}>{renderDropdownContent()}</DropdownMenu.Portal>
                ) : (
                    renderDropdownContent()
                )}
            </DropdownMenu.Root>
        );
    }
);

FernDropdown.displayName = "FernDropdown";

function FernDropdownItemValue({
    option,
    value,
    dropdownMenuElement,
    container
}: {
    option: FernDropdown.ValueOption;
    value: string | undefined;
    dropdownMenuElement: ReactElement | undefined;
    container?: HTMLElement;
}) {
    const helperTextRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
    useEffect(() => {
        if (option.value === value) {
            activeRef.current?.scrollIntoView({ block: "center" });
        }
    }, [option.value, value]);

    const [isEllipsisActive, setIsEllipsisActive] = useState(false);
    useResizeObserver(helperTextRef, (entries) => {
        for (const entry of entries) {
            setIsEllipsisActive(entry.target.scrollWidth > entry.target.clientWidth);
        }
    });

    function renderButtonContent() {
        return (
            <div className="w-full">
                <div className="flex items-center gap-2">
                    {option.icon}

                    <div className={option.labelClassName}>{option.label ?? option.value}</div>
                    <span className="ml-auto space-x-1">
                        {option.rightElement && <span>{option.rightElement}</span>}
                        {(isEllipsisActive || (option.tooltip != null && option.tooltip !== "")) && (
                            <Info className="size-icon" />
                        )}
                    </span>

                    <DropdownMenu.ItemIndicator asChild>
                        <Check />
                    </DropdownMenu.ItemIndicator>
                </div>

                {option.helperText != null && (
                    <div className="mt-0.5 text-start text-xs leading-snug opacity-60" ref={helperTextRef}>
                        {option.helperText}
                    </div>
                )}
            </div>
        );
    }

    // Note: we ignore href on the option if a custom dropdownMenuElement is not provided
    return (
        <FernTooltip
            content={
                !isEllipsisActive ? (
                    option.tooltip
                ) : (
                    <div className="space-y-2">
                        {option.helperText != null && <div>{option.helperText}</div>}
                        {option.tooltip != null && <div>{option.tooltip}</div>}
                    </div>
                )
            }
            side="right"
            sideOffset={8}
            container={container}
        >
            <DropdownMenu.RadioItem
                asChild={true}
                value={option.value}
                className="[&_svg]:size-icon data-[state=unchecked]:text-(color:--grayscale-a11 data-[highlighted]:data-[state=unchecked]:text-(color:--accent-contrast))"
            >
                {dropdownMenuElement != null ? (
                    cloneElement(
                        dropdownMenuElement,
                        {
                            ref: option.value === value ? activeRef : undefined,
                            href: option.href,
                            className: cn("fern-dropdown-item", option.className)
                        } as any,
                        renderButtonContent()
                    )
                ) : (
                    <button
                        ref={option.value === value ? activeRef : undefined}
                        className={cn("fern-dropdown-item", option.className)}
                    >
                        {renderButtonContent()}
                    </button>
                )}
            </DropdownMenu.RadioItem>
        </FernTooltip>
    );
}

function FernDropdownItemAuth({ option }: { option: FernDropdown.AuthOption }) {
    return (
        <DropdownMenu.RadioItem asChild={true} value={option.key}>
            <div className="flex cursor-pointer items-center justify-between gap-2 px-2 py-1">
                <div className="text-sm">{option.key}</div>

                <DropdownMenu.ItemIndicator asChild>
                    <Check />
                </DropdownMenu.ItemIndicator>
            </div>
        </DropdownMenu.RadioItem>
    );
}

function FernDropdownItemMultiSelect({
    option,
    isSelected,
    onToggle,
    dropdownMenuElement,
    container
}: {
    option: FernDropdown.ValueOption;
    isSelected: boolean;
    onToggle: (value: string) => void;
    dropdownMenuElement: ReactElement | undefined;
    container?: HTMLElement;
}) {
    const helperTextRef = useRef<HTMLDivElement>(null);
    const [isEllipsisActive, setIsEllipsisActive] = useState(false);

    useResizeObserver(helperTextRef, (entries) => {
        for (const entry of entries) {
            setIsEllipsisActive(entry.target.scrollWidth > entry.target.clientWidth);
        }
    });

    function renderButtonContent() {
        return (
            <div className="w-full">
                <div className="flex items-center gap-2">
                    {option.icon}

                    <div ref={helperTextRef} className={option.labelClassName}>
                        {option.label ?? option.value}
                    </div>
                    <span className="ml-auto space-x-1">
                        {option.rightElement && <span>{option.rightElement}</span>}
                    </span>

                    {isSelected && <Check className="size-icon" />}
                </div>
            </div>
        );
    }

    const handleClick = () => {
        onToggle(option.value);
    };

    return (
        <FernTooltip content={isEllipsisActive ? option.value : ""} side="right" sideOffset={8} container={container}>
            {dropdownMenuElement != null ? (
                cloneElement(
                    dropdownMenuElement,
                    {
                        href: option.href,
                        className: cn(
                            "fern-dropdown-item cursor-pointer",
                            isSelected && "bg-accent-subtle",
                            option.className
                        ),
                        onClick: handleClick
                    } as any,
                    renderButtonContent()
                )
            ) : (
                <button
                    className={cn(
                        "fern-dropdown-item cursor-pointer",
                        isSelected && "bg-accent-subtle",
                        option.className
                    )}
                    onClick={handleClick}
                >
                    {renderButtonContent()}
                </button>
            )}
        </FernTooltip>
    );
}
