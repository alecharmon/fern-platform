"use client";

import { t } from "@fern-docs/i18n";

import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { isEqual } from "es-toolkit/predicate";
import { Undo2, X } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef, useRef } from "react";
import { cn } from "./cn";
import { Button } from "./FernButtonV2";
import { FernTooltip, FernTooltipProvider } from "./FernTooltip";

export interface FernInputProps extends Omit<ComponentPropsWithoutRef<"input">, "value" | "defaultValue"> {
    value?: string;
    defaultValue?: string;

    /**
     * Additional classes to apply to the input element
     */
    inputClassName?: string;
    /**
     * Icon to render on the left side of the input
     */
    leftIcon?: React.ReactNode;
    /**
     * Element to render on the right side of the input
     */
    rightElement?: React.ReactNode;
    /**
     * Callback to call when the value changes
     */
    onValueChange?: (value: string) => void;
    /**
     * Whether the input should render a reset button if the default value is different from the current value
     * @default false
     */
    resettable?: boolean;
    /**
     * Callback to call when the reset button is clicked
     */
    onClickReset?: () => void;
    /**
     * Whether to show a clear button inside the input when there is a value
     * @default false
     */
    clearable?: boolean;
    /**
     * Callback to call when the clear button is clicked
     */
    onClear?: () => void;
    lang: string;
}

export const FernInput = forwardRef<HTMLInputElement, FernInputProps>(function FernInput(
    {
        className,
        inputClassName,
        onValueChange,
        leftIcon,
        rightElement,
        resettable,
        onClickReset,
        clearable,
        onClear,
        lang,
        ...props
    },
    forwardedRef
) {
    const inputRef = useRef<HTMLInputElement>(null);
    const hasValue = props.value != null && props.value.length > 0;

    const handleClear = () => {
        onClear?.();
        onValueChange?.("");
        inputRef.current?.focus();
    };

    return (
        <div className={cn("fern-input-group", className)}>
            {leftIcon && <span className="fern-input-icon">{leftIcon}</span>}
            <input
                ref={composeRefs(forwardedRef, inputRef)}
                {...props}
                className={cn("fern-input", inputClassName)}
                onChange={composeEventHandlers(
                    props.onChange,
                    (e) => {
                        if (props.maxLength != null && e.currentTarget.value.length > props.maxLength) {
                            return;
                        }

                        onValueChange?.(e.currentTarget.value);
                    },
                    { checkForDefaultPrevented: true }
                )}
                placeholder={props.placeholder ?? props.defaultValue}
            />
            {clearable && hasValue && (
                <button
                    type="button"
                    className="fern-input-clear-button"
                    onClick={handleClear}
                    aria-label="Clear input"
                >
                    <X className="size-3.5" />
                </button>
            )}
            <FernInputRightElement
                value={props.value}
                onReset={
                    onClickReset ??
                    (() => {
                        if (props.defaultValue != null) {
                            onValueChange?.(props.defaultValue);
                            inputRef.current?.focus();
                        }
                    })
                }
                resettable={resettable}
                lang={lang}
            >
                {rightElement}
            </FernInputRightElement>
        </div>
    );
});

const FernInputResetButton = forwardRef<
    HTMLButtonElement,
    Omit<ComponentPropsWithoutRef<typeof Button>, "variant" | "size" | "children">
>(function FernInputResetButton({ onClick, ...props }, forwardedRef) {
    return (
        <Button ref={forwardedRef} variant="ghost" size="iconSm" onClick={onClick} {...props}>
            <Undo2 />
        </Button>
    );
});

function FernInputRightElement({
    children,
    value,
    defaultValue,
    onReset,
    resettable,
    lang
}: {
    children?: React.ReactNode;
    value?: string;
    defaultValue?: string;
    onReset: () => void;
    resettable?: boolean;
    lang: string;
}) {
    if (resettable && defaultValue != null && !isEqual(value, defaultValue)) {
        return (
            <FernTooltipProvider>
                <FernTooltip
                    content={
                        <div className="space-y-2">
                            <p>{t(lang).buttons.resetToTheDefaultValue}</p>
                            <p className="break-all">
                                <code>{defaultValue}</code>
                            </p>
                        </div>
                    }
                >
                    <FernInputResetButton onClick={onReset} className="mr-0.5 shrink-0" />
                </FernTooltip>
            </FernTooltipProvider>
        );
    }

    if (!children) {
        return null;
    }

    return <span className="fern-input-right-element">{children}</span>;
}
