import { isSelfHosted } from "@fern-api/docs-server";
import { atom, useAtom } from "jotai";
import { useCallback } from "react";
import { useSearchBox as useAlgoliaSearchBox } from "react-instantsearch";

/**
 * Global atom to persist the Meilisearch query across the app.
 */
const meilisearchQueryAtom = atom<string>("");

/**
 * Minimal Meilisearch search box hook, modeled after Algolia's useSearchBox.
 * Persists the query across the app using a jotai atom.
 */
function useMeilisearchBox(): ReturnType<typeof useAlgoliaSearchBox> {
    const [query, setQuery] = useAtom(meilisearchQueryAtom);

    const refine = useCallback(
        (nextQuery: string) => {
            setQuery(nextQuery);
        },
        [setQuery]
    );

    const clear = useCallback(() => {
        setQuery("");
    }, [setQuery]);

    return {
        query,
        refine,
        clear,
        isSearchStalled: false
    };
}

export function useSearchBox(): ReturnType<typeof useAlgoliaSearchBox> {
    if (isSelfHosted()) {
        return useMeilisearchBox();
    }
    return useAlgoliaSearchBox();
}
