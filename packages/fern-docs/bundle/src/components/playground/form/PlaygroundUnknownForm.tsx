"use client";

import { FernTextarea } from "@fern-docs/components/FernTextarea";
import { t } from "@fern-docs/i18n";
import { type ReactElement, useCallback, useEffect, useState } from "react";

interface PlaygroundUnknownFormProps {
    id: string;
    onChange: (value: unknown) => void;
    value: unknown;
    disabled?: boolean;
    lang: string;
}

function stringifyValue(value: unknown): string {
    if (value === undefined || value === null || value === "") {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return "";
    }
}

export function PlaygroundUnknownForm({
    id,
    onChange,
    value,
    disabled = false,
    lang
}: PlaygroundUnknownFormProps): ReactElement {
    const [textValue, setTextValue] = useState(() => stringifyValue(value));
    const [isValidJson, setIsValidJson] = useState(true);

    // biome-ignore lint/correctness/useExhaustiveDependencies: Only update when value changes from outside, not when user types
    useEffect(() => {
        const stringified = stringifyValue(value);
        if (stringified !== textValue) {
            setTextValue(stringified);
        }
    }, [value]);

    const handleChange = useCallback(
        (newTextValue: string) => {
            setTextValue(newTextValue);

            if (newTextValue.trim() === "") {
                setIsValidJson(true);
                onChange(undefined);
                return;
            }

            try {
                const parsed = JSON.parse(newTextValue);
                setIsValidJson(true);
                onChange(parsed);
            } catch {
                setIsValidJson(false);
                onChange(newTextValue);
            }
        },
        [onChange]
    );

    return (
        <div className="w-full">
            <FernTextarea
                id={id}
                className="w-full font-mono text-sm"
                value={textValue}
                onValueChange={handleChange}
                disabled={disabled}
                placeholder={t(lang).ui.jsonPlaceholder}
                minLines={3}
            />
            {!isValidJson && textValue.trim() !== "" && (
                <p className="text-(color:--red-a11) mt-1 text-xs">{t(lang).ui.invalidJson}</p>
            )}
        </div>
    );
}
