import { isSelfHosted } from "@fern-api/docs-server";
import type { AlgoliaRecord } from "@fern-docs/search-keyword/types";

import type { SendEventForHits } from "instantsearch.js/es/lib/utils";
import { useDeferredValue } from "react";
import { useHits, useInfiniteHits } from "react-instantsearch";

import type { AlgoliaRecordHit } from "../types";
import {
    useMeilisearchHits,
    useMeilisearchInfiniteHits,
    useMeilisearchSendEvent
} from "./meilisearch/use-infinite-hits";

export function useSearchHits(): AlgoliaRecordHit[] {
    if (isSelfHosted()) {
        return useDeferredValue(useMeilisearchHits());
    }
    const { items } = useHits<AlgoliaRecord>();
    return useDeferredValue(items);
}

export function useSendEvent(): SendEventForHits {
    if (isSelfHosted()) {
        return useMeilisearchSendEvent();
    }
    const { sendEvent } = useHits();
    return sendEvent;
}

export function useInfiniteSearchHits() {
    if (isSelfHosted()) {
        return useMeilisearchInfiniteHits();
    }
    return useInfiniteHits<AlgoliaRecord>();
}
