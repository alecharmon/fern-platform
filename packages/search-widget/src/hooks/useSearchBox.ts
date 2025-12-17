import { useSearchBox as useAlgoliaSearchBox } from "react-instantsearch";

export function useSearchBox(): ReturnType<typeof useAlgoliaSearchBox> {
    return useAlgoliaSearchBox();
}
