"use client";

import type { EndpointDefinition } from "@fern-api/fdr-sdk/api-definition";
import { useDeepCompareMemoize } from "@fern-ui/react-commons";
import type { SetStateAction } from "jotai";
import { RESET } from "jotai/utils";
import React, { useMemo } from "react";
import { getProgrammingLanguage, useDefaultProgrammingLanguage, useProgrammingLanguage } from "../../state/language";
import type { CodeExample } from "../examples/code-example";
import {
    getAvailableLanguages,
    getAvailableLanguagesByStatusCode,
    groupExamplesByLanguageKeyAndStatusCode,
    selectExampleToRender
} from "../examples/example-groups";
import type {
    ExamplesByKeyAndStatusCode,
    ExamplesByStatusCode,
    SelectedExampleKey
} from "../type-definitions/EndpointContent";

// "payload" is a virtual language that shows the raw request body/query params as JSON
export const PAYLOAD_LANGUAGE = "payload";

export function useExampleSelection(
    endpoint: EndpointDefinition,
    initialExampleId?: string
): {
    selectedExample: CodeExample | undefined;
    examplesByStatusCode: ExamplesByStatusCode;
    examplesByKeyAndStatusCode: ExamplesByKeyAndStatusCode;
    selectedExampleKey: SelectedExampleKey;
    defaultLanguage: string;
    availableLanguages: string[];
    availableLanguagesByStatusCode: Record<string, string[]>;
    setSelectedExampleKey: (update: typeof RESET | SetStateAction<SelectedExampleKey>) => void;
} {
    const examplesByLanguageKeyAndStatusCode = React.useMemo(
        () => groupExamplesByLanguageKeyAndStatusCode(endpoint),
        [endpoint]
    );

    const getInitialExampleKey = React.useCallback(
        (language: string): SelectedExampleKey => {
            if (initialExampleId == null) {
                return {
                    language,
                    exampleKey: undefined,
                    statusCode: undefined,
                    responseIndex: undefined
                };
            }
            const allExamples = Object.values(
                examplesByLanguageKeyAndStatusCode[language] ?? examplesByLanguageKeyAndStatusCode.curl ?? {}
            )
                .flatMap((e) => Object.values(e))
                .flat();

            const example = allExamples.find(
                (e) => e.name === initialExampleId || e.exampleCall.name === initialExampleId
            );
            if (example == null) {
                return {
                    language,
                    exampleKey: undefined,
                    statusCode: undefined,
                    responseIndex: undefined
                };
            }

            return {
                language,
                exampleKey: example.exampleKey,
                statusCode: String(example.exampleCall.responseStatusCode),
                responseIndex: undefined
            };
        },
        // biome-ignore lint/correctness/useExhaustiveDependencies: only run when examplesByLanguageKeyAndStatusCode or initialExampleId changes
        useDeepCompareMemoize([examplesByLanguageKeyAndStatusCode, initialExampleId])
    );

    // We use a string here with the intention that this can be used in a query param to deeplink to a particular example
    // const [internalSelectedExampleKey, setSelectedExampleKey] = useR(
    //   useMemoOne(() => {
    //     const internalAtom = atomWithDefault<SelectedExampleKey>((get) => {
    //       return getInitialExampleKey(
    //         get(FERN_LANGUAGE_ATOM) ?? get(DEFAULT_LANGUAGE_ATOM)
    //       );
    //     });

    //     return atom(
    //       (get) => get(internalAtom),
    //       (
    //         get,
    //         set,
    //         update: SetStateAction<SelectedExampleKey> | typeof RESET
    //       ) => {
    //         const prev = get(internalAtom);
    //         const next = typeof update === "function" ? update(prev) : update;
    //         if (next !== RESET) {
    //           set(FERN_LANGUAGE_ATOM, next.language);
    //         }
    //         set(internalAtom, next);
    //       }
    //     );
    //   }, [getInitialExampleKey])
    // );

    const [globalLanguage, setGlobalLanguage] = useProgrammingLanguage();
    const defaultLanguage = useDefaultProgrammingLanguage();

    const [internalSelectedExampleKey, setSelectedExampleKeyInner] = React.useState<SelectedExampleKey>(() => {
        return getInitialExampleKey(globalLanguage ?? defaultLanguage);
    });

    // Track the last real language used (not "payload") using a ref
    // Initialize with the actual language from the initial state
    const lastRealLanguageRef = React.useRef(internalSelectedExampleKey.language);

    const setSelectedExampleKey = React.useCallback(
        (update: typeof RESET | SetStateAction<SelectedExampleKey>) => {
            setSelectedExampleKeyInner((prev) => {
                const next = typeof update === "function" ? update(prev) : update;
                if (next === RESET) {
                    const lang = getProgrammingLanguage();
                    lastRealLanguageRef.current = lang;
                    return getInitialExampleKey(lang);
                }

                // If switching to a real language (not "payload"), update the ref and global language
                if (next.language !== PAYLOAD_LANGUAGE) {
                    lastRealLanguageRef.current = next.language;
                    if (next.language !== prev.language && prev.language !== PAYLOAD_LANGUAGE) {
                        setGlobalLanguage(next.language);
                    } else if (prev.language === PAYLOAD_LANGUAGE) {
                        // Switching from payload to a real language
                        setGlobalLanguage(next.language);
                    }
                }
                // Allow "payload" to be stored in the state
                return next;
            });
        },
        [getInitialExampleKey, setGlobalLanguage]
    );

    React.useEffect(() => {
        if (
            globalLanguage != null &&
            globalLanguage !== PAYLOAD_LANGUAGE &&
            internalSelectedExampleKey.language !== globalLanguage &&
            internalSelectedExampleKey.language !== PAYLOAD_LANGUAGE
        ) {
            lastRealLanguageRef.current = globalLanguage;
            setSelectedExampleKeyInner((prev) => ({ ...prev, language: globalLanguage }));
        }
    }, [globalLanguage, internalSelectedExampleKey.language]);

    // When computing selectedExample, use the last real language if current is "payload"
    const languageForExample =
        internalSelectedExampleKey.language === PAYLOAD_LANGUAGE
            ? lastRealLanguageRef.current
            : internalSelectedExampleKey.language;

    const availableLanguages = useMemo(
        () => getAvailableLanguages(examplesByLanguageKeyAndStatusCode, defaultLanguage),
        [examplesByLanguageKeyAndStatusCode, defaultLanguage]
    );

    // Use languageForExample to get the actual example data (uses last real language when payload is selected)
    const exampleKeyForLookup = useMemo(
        () => ({ ...internalSelectedExampleKey, language: languageForExample }),
        [internalSelectedExampleKey, languageForExample]
    );

    const { selectedExample, examplesByStatusCode, examplesByKeyAndStatusCode, selectedExampleKey } = useMemo(
        () => selectExampleToRender(examplesByLanguageKeyAndStatusCode, exampleKeyForLookup, defaultLanguage),
        [defaultLanguage, examplesByLanguageKeyAndStatusCode, exampleKeyForLookup]
    );

    const availableLanguagesByStatusCode = useMemo(
        () => getAvailableLanguagesByStatusCode(examplesByLanguageKeyAndStatusCode, defaultLanguage),
        [examplesByLanguageKeyAndStatusCode, defaultLanguage]
    );

    // Return the actual selected language (including "payload") in selectedExampleKey
    const finalSelectedExampleKey = useMemo(
        () => ({ ...selectedExampleKey, language: internalSelectedExampleKey.language }),
        [selectedExampleKey, internalSelectedExampleKey.language]
    );

    return {
        selectedExample,
        examplesByStatusCode,
        examplesByKeyAndStatusCode,
        selectedExampleKey: finalSelectedExampleKey,
        defaultLanguage,
        availableLanguages,
        availableLanguagesByStatusCode,
        setSelectedExampleKey
    };
}
