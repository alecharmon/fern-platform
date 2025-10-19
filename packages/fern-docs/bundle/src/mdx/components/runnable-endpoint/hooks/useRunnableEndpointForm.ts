import type { EndpointDefinition, TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlaygroundEndpointRequestFormState } from "@/components/playground/types";
import { getInitialEndpointRequestFormStateWithExample } from "@/components/playground/utils";
import { useResolvedPlaygroundState } from "@/state/playground";
import {
    clearFormValuesFromStorage,
    loadFormValuesFromStorage,
    mergeFormStateWithStorage,
    useFormStatePersistence
} from "./useFormStatePersistence";

interface UseRunnableEndpointFormParams {
    endpoint: EndpointDefinition;
    types: Record<string, TypeDefinition>;
    globalHeaders: EndpointDefinition["requestHeaders"];
    example?: string;
}

interface UseRunnableEndpointFormReturn {
    formState: PlaygroundEndpointRequestFormState;
    selectedExampleIndex: number;
    exampleOptions: { type: "value"; label: string; value: string }[];
    hasMultipleExamples: boolean;
    setHeaders: (value: ((old: unknown) => unknown) | unknown) => void;
    setPathParameters: (value: ((old: unknown) => unknown) | unknown) => void;
    setQueryParameters: (value: ((old: unknown) => unknown) | unknown) => void;
    setBodyJson: (value: ((old: unknown) => unknown) | unknown) => void;
    setSelectedExampleIndex: (index: number) => void;
    clearForm: () => void;
}

export function useRunnableEndpointForm({
    endpoint,
    types,
    globalHeaders,
    example
}: UseRunnableEndpointFormParams): UseRunnableEndpointFormReturn {
    const resolvedPlaygroundState = useResolvedPlaygroundState();

    // Create a minimal context for form state initialization
    const minimalContext = useMemo(
        () => ({
            endpoint,
            types,
            globalHeaders,
            auths: []
        }),
        [endpoint, types, globalHeaders]
    );

    // Find the example if specified
    const initialExampleIndex = useMemo(() => {
        if (!example || !endpoint.examples) {
            return 0;
        }
        const foundIndex = endpoint.examples.findIndex((ex) => ex.name === example);
        return foundIndex !== -1 ? foundIndex : 0;
    }, [endpoint.examples, example]);

    const [selectedExampleIndex, setSelectedExampleIndex] = useState<number>(initialExampleIndex);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Initialize form state
    const initialFormState = useMemo(() => {
        const initialExample = endpoint.examples?.[initialExampleIndex];
        const baseFormState = getInitialEndpointRequestFormStateWithExample(
            minimalContext as any,
            initialExample,
            resolvedPlaygroundState
        );

        const savedValues = loadFormValuesFromStorage();
        return mergeFormStateWithStorage(baseFormState, savedValues);
    }, [endpoint.examples, initialExampleIndex, minimalContext, resolvedPlaygroundState]);

    const [formState, setFormState] = useState<PlaygroundEndpointRequestFormState>(initialFormState);
    // Persist form values to localStorage
    useFormStatePersistence(formState);

    // Update form state when example changes
    useEffect(() => {
        // Skip the initial effect run since we already initialized the form state
        if (isInitialLoad) {
            setIsInitialLoad(false);
            return;
        }

        const example = endpoint.examples?.[selectedExampleIndex];
        if (example) {
            // When switching examples intentionally, reset to pure example values
            // WITHOUT merging with localStorage
            const baseFormState = getInitialEndpointRequestFormStateWithExample(
                minimalContext as any,
                example,
                resolvedPlaygroundState
            );

            setFormState(baseFormState);
        }
    }, [selectedExampleIndex, endpoint.examples, minimalContext, resolvedPlaygroundState, isInitialLoad]);

    // Form state setters
    const setHeaders = useCallback((value: ((old: unknown) => unknown) | unknown) => {
        setFormState((state) => ({
            ...state,
            headers: typeof value === "function" ? value(state.headers) : value
        }));
    }, []);

    const setPathParameters = useCallback((value: ((old: unknown) => unknown) | unknown) => {
        setFormState((state) => ({
            ...state,
            pathParameters: typeof value === "function" ? value(state.pathParameters) : value
        }));
    }, []);

    const setQueryParameters = useCallback((value: ((old: unknown) => unknown) | unknown) => {
        setFormState((state) => ({
            ...state,
            queryParameters: typeof value === "function" ? value(state.queryParameters) : value
        }));
    }, []);

    const setBodyJson = useCallback((value: ((old: unknown) => unknown) | unknown) => {
        setFormState((state) => ({
            ...state,
            body: {
                type: "json",
                value:
                    typeof value === "function"
                        ? value(state.body?.type === "json" ? state.body.value : undefined)
                        : value
            }
        }));
    }, []);

    const clearForm = useCallback(() => {
        clearFormValuesFromStorage();

        const example = endpoint.examples?.[selectedExampleIndex];
        const resetFormState = getInitialEndpointRequestFormStateWithExample(
            minimalContext as any,
            example,
            resolvedPlaygroundState
        );
        setFormState(resetFormState);
    }, [endpoint.examples, selectedExampleIndex, minimalContext, resolvedPlaygroundState]);

    // Example options
    const exampleOptions = useMemo(() => {
        if (!endpoint.examples || endpoint.examples.length === 0) {
            return [];
        }
        return endpoint.examples.map((ex, index) => ({
            type: "value" as const,
            label: ex.name || `Example ${index + 1}`,
            value: String(index)
        }));
    }, [endpoint.examples]);

    const hasMultipleExamples = exampleOptions.length > 1;

    return {
        formState,
        selectedExampleIndex,
        exampleOptions,
        hasMultipleExamples,
        setHeaders,
        setPathParameters,
        setQueryParameters,
        setBodyJson,
        setSelectedExampleIndex,
        clearForm
    };
}
