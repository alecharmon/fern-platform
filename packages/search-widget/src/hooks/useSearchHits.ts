import type { AlgoliaRecord } from "@fern-docs/search-keyword/types";
import type { SendEventForHits } from "instantsearch.js/es/lib/utils";
import { useDeferredValue } from "react";
import { useHits, useInfiniteHits } from "react-instantsearch";

import type { AlgoliaRecordHit } from "./types";

export function useSearchHits(): AlgoliaRecordHit[] {
    const { items } = useHits<AlgoliaRecord>();
    return useDeferredValue(items);
}

export function useSendEvent(): SendEventForHits {
    const { sendEvent } = useHits();
    return sendEvent;
}

export function useInfiniteSearchHits() {
    return useInfiniteHits<AlgoliaRecord>();
}
