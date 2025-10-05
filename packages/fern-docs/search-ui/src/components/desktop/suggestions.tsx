"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { experimental_useObject } from "@ai-sdk/react";
import { debounce } from "es-toolkit/function";

import { isNonNullish } from "@fern-api/ui-core-utils";
import { SuggestionsSchema } from "@fern-docs/search-ask-fern";

import * as Command from "../cmdk";
import { Skeleton } from "../ui/skeleton";

export const Suggestions = ({
    api,
    body,
    headers,
    askAI
}: {
    api: string;
    body?: object;
    headers?: Record<string, string>;
    askAI: (suggestion: string) => void;
}): ReactNode => {
    const [isLoading, setIsLoading] = useState(true);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const { object, submit } = experimental_useObject({
        api,
        schema: SuggestionsSchema,
        headers,
        onFinish: () => {
            setIsLoading(false);
            // Trigger cascading animation after suggestions are loaded
            requestAnimationFrame(() => {
                setShouldAnimate(true);
            });
        }
    });

    const debouncedSubmit = useMemo(
        () => debounce(submit, 500, { edges: ["leading"] }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    useEffect(() => {
        debouncedSubmit(body);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (object?.suggestions == null && !isLoading) {
        return false;
    }

    const suggestions = object?.suggestions?.filter(isNonNullish) ?? [];

    return (
        <Command.Group forceMount heading="Suggestions">
            {suggestions.map((suggestion, index) => {
                return (
                    <Command.Item
                        key={suggestion}
                        value={suggestion}
                        onSelect={() => askAI(suggestion)}
                        className={`text-(color:--accent) bg-transparent text-[12px] font-semibold transition-all duration-300 ease-out hover:cursor-pointer hover:underline ${
                            shouldAnimate ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                        }`}
                        style={{
                            transitionDelay: shouldAnimate ? `${index * 100}ms` : "0ms"
                        }}
                        forceMount
                    >
                        {suggestion}
                    </Command.Item>
                );
            })}
            {isLoading &&
                suggestions.length < 5 &&
                Array.from({ length: 5 - suggestions.length }).map((_, index) => (
                    <Command.Item key={`skeleton-${index}`} forceMount disabled>
                        <Skeleton className="h-5 w-full" />
                    </Command.Item>
                ))}
        </Command.Group>
    );
};
