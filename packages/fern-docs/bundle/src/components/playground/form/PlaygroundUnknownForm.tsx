"use client";

import { FernTextarea } from "@fern-docs/components/FernTextarea";
import { t } from "@fern-docs/i18n";
import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";

interface PlaygroundUnknownFormProps {
    id: string;
    onChange: (value: unknown) => void;
    value: unknown;
    disabled?: boolean;
    lang: string;
}

function stringifyValue(value: unknown): string {
    if (value === undefined || value === null || value === "") {
        return "{}";
    }
    if (typeof value === "string") {
        try {
            JSON.parse(value);
            return value;
        } catch {
            return "{}";
        }
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return "{}";
    }
}

function deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
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
    const lastParsedValueRef = useRef<unknown>(value);

    useEffect(() => {
        // Only update textValue if the value prop changed externally (not from user input)
        if (!deepEqual(value, lastParsedValueRef.current)) {
            const stringified = stringifyValue(value);
            setTextValue(stringified);
            setIsValidJson(true);
            lastParsedValueRef.current = value;
        }
    }, [value]);

    const handleChange = useCallback(
        (newTextValue: string) => {
            setTextValue(newTextValue);

            const trimmed = newTextValue.trim();
            if (trimmed === "" || trimmed === "{}") {
                setIsValidJson(true);
                lastParsedValueRef.current = {};
                onChange({});
                return;
            }

            try {
                const parsed = JSON.parse(newTextValue);
                setIsValidJson(true);
                lastParsedValueRef.current = parsed;
                onChange(parsed);
            } catch {
                setIsValidJson(false);
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
            {!isValidJson && <p className="text-(color:--red-a11) mt-1 text-xs">{t(lang).ui.invalidJson}</p>}
        </div>
    );
}
