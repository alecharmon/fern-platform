"use client";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { FERN_SEARCH_BUTTON_ID } from "@fern-docs/components/constants";
import { t } from "@fern-docs/i18n";
import { DesktopSearchButton } from "@fern-docs/search-ui";
import { composeEventHandlers } from "@radix-ui/primitive";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import React, { useCallback, useEffect, useRef } from "react";

export const searchDialogOpenAtom = atom(false);
export const searchInitializedAtom = atom(false);
export const isAskAiEnabledAtom = atom(false);

export const SetIsAskAiEnabled = ({ isAskAiEnabled }: { isAskAiEnabled: boolean }) => {
    useHydrateAtoms([[isAskAiEnabledAtom, isAskAiEnabled]], {
        dangerouslyForceHydrate: true
    });
    return null;
};

export const useIsAskAiEnabled = () => {
    return useAtomValue(isAskAiEnabledAtom);
};

export const isDefaultSearchFilterOnAtom = atom(false);

export const SetIsDefaultSearchFilterOn = ({ isDefaultSearchFilterOn }: { isDefaultSearchFilterOn: boolean }) => {
    useHydrateAtoms([[isDefaultSearchFilterOnAtom, isDefaultSearchFilterOn]], {
        dangerouslyForceHydrate: true
    });
    return null;
};

export const useIsDefaultSearchFilterOn = () => {
    return useAtomValue(isDefaultSearchFilterOnAtom);
};

searchInitializedAtom.onMount = (setInitialized) => {
    if (typeof window === "undefined") {
        return;
    }

    if (isLocal()) {
        return;
    }

    const initialize = () => {
        setInitialized(true);
    };

    if (isSelfHosted()) {
        initialize();
    }

    // enable other components to initialize the search state
    window.addEventListener("search:initialized", initialize);
    return () => {
        window.removeEventListener("search:initialized", initialize);
    };
};

export const SearchV2Trigger = React.memo(function SearchV2Trigger(
    props: React.ComponentProps<typeof DesktopSearchButton>
) {
    const isInitialized = useAtomValue(searchInitializedAtom);
    const toggleSearchDialog = useToggleSearchDialog();
    const isLocalEnvironment = isLocal();
    const placeholder = props.placeholder ?? t(props.lang).search.search;

    return (
        <DesktopSearchButton
            /**
             * IMPORTANT: This component must be rendered only ONCE in the entire DOM tree,
             * because the ID must be unique across the entire document.
             */
            id={FERN_SEARCH_BUTTON_ID}
            {...props}
            onClick={composeEventHandlers(props.onClick, toggleSearchDialog)}
            variant={isInitialized && !isLocalEnvironment ? "default" : "loading"}
            placeholder={placeholder}
            disabled={props.disabled ?? false}
        />
    );
});

export function useIsSearchDialogOpen(): boolean {
    return useAtomValue(searchDialogOpenAtom);
}

export function useToggleSearchDialog(): () => void {
    const setSearchDialogState = useSetAtom(searchDialogOpenAtom);
    return () => setSearchDialogState((prev) => !prev);
}

export const selectedFiltersAtom = atom<string[]>([]);

export const useSelectedFilters = () => {
    return useAtomValue(selectedFiltersAtom);
};

export const useSetSelectedFilters = () => {
    return useSetAtom(selectedFiltersAtom);
};

const FILTER_PARAM = "filter";

/**
 * Syncs the selectedFiltersAtom with the `?filter=` URL search parameter.
 * On mount, reads from the URL and initializes the atom.
 * When filters change, updates the URL without a full page reload.
 *
 * @param availableTags - The actual tag names from the changelog entries,
 *   used for case-insensitive matching against URL param values.
 */
export function useSyncFiltersWithUrl(availableTags: string[]): void {
    const selectedFilters = useAtomValue(selectedFiltersAtom);
    const setSelectedFilters = useSetAtom(selectedFiltersAtom);
    const isInitializedRef = useRef(false);

    // On mount, read filters from URL and resolve to correct casing
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const filterParam = params.get(FILTER_PARAM);
        if (filterParam) {
            const rawFilters = filterParam
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean);
            // Match each URL param value to the actual tag name case-insensitively
            const resolved = rawFilters
                .map((raw) => availableTags.find((tag) => tag.toLowerCase() === raw.toLowerCase()))
                .filter((tag): tag is string => tag != null);
            if (resolved.length > 0) {
                setSelectedFilters(resolved);
            }
        }
        isInitializedRef.current = true;
    }, [setSelectedFilters, availableTags]);

    // When filters change (after initialization), update the URL
    const updateUrl = useCallback((filters: string[]) => {
        const url = new URL(window.location.href);
        if (filters.length > 0) {
            url.searchParams.set(FILTER_PARAM, filters.join(","));
        } else {
            url.searchParams.delete(FILTER_PARAM);
        }
        window.history.replaceState(window.history.state, "", url.toString());
    }, []);

    useEffect(() => {
        if (!isInitializedRef.current) {
            return;
        }
        updateUrl(selectedFilters);
    }, [selectedFilters, updateUrl]);
}
