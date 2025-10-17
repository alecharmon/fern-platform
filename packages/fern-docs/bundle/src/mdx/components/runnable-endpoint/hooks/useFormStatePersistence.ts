import { useEffect } from "react";
import type { PlaygroundEndpointRequestFormState } from "@/components/playground/types";

const STORAGE_KEY = "fern-runnable-endpoint-values";

interface SavedFormValues {
    headers?: Record<string, unknown>;
    pathParameters?: Record<string, unknown>;
    queryParameters?: Record<string, unknown>;
    body?: unknown;
}

export function saveFormValuesToStorage(formState: PlaygroundEndpointRequestFormState): void {
    try {
        const valuesToSave: SavedFormValues = {
            headers: formState.headers ?? {},
            pathParameters: formState.pathParameters ?? {},
            queryParameters: formState.queryParameters ?? {},
            body: formState.body?.type === "json" ? formState.body.value : undefined
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(valuesToSave));
    } catch (_error) {
        // Silently fail if localStorage is not available
    }
}

export function loadFormValuesFromStorage(): SavedFormValues | null {
    try {
        const savedValues = localStorage.getItem(STORAGE_KEY);
        if (savedValues) {
            return JSON.parse(savedValues);
        }
    } catch (_error) {
        // Silently fail if localStorage is not available or JSON is invalid
    }
    return null;
}

export function clearFormValuesFromStorage(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
        // Silently fail if localStorage is not available
    }
}

export function mergeFormStateWithStorage(
    baseFormState: PlaygroundEndpointRequestFormState,
    savedValues: SavedFormValues | null
): PlaygroundEndpointRequestFormState {
    if (!savedValues) {
        return baseFormState;
    }

    return {
        ...baseFormState,
        headers: { ...(baseFormState.headers ?? {}), ...(savedValues.headers ?? {}) },
        pathParameters: { ...(baseFormState.pathParameters ?? {}), ...(savedValues.pathParameters ?? {}) },
        queryParameters: { ...(baseFormState.queryParameters ?? {}), ...(savedValues.queryParameters ?? {}) },
        body:
            savedValues.body &&
            baseFormState.body?.type === "json" &&
            typeof baseFormState.body.value === "object" &&
            baseFormState.body.value != null &&
            typeof savedValues.body === "object" &&
            savedValues.body != null
                ? {
                      type: "json" as const,
                      value: { ...baseFormState.body.value, ...savedValues.body }
                  }
                : baseFormState.body
    };
}

export function useFormStatePersistence(formState: PlaygroundEndpointRequestFormState): void {
    useEffect(() => {
        saveFormValuesToStorage(formState);
    }, [formState]);
}
