import { FilterCondition, Filters } from "@turbopuffer/turbopuffer";

import { FacetFilter } from "@fern-docs/search-keyword";

export function buildNegationFilters(
  field: string,
  values: string[] = []
): FilterCondition[] {
  return values.map((v) => [field, "NotEq", v]);
}

export const buildQueryFilters = ({
  filters,
  documentIdsToIgnore,
  urlsToIgnore,
}: {
  filters: FacetFilter[];
  documentIdsToIgnore: string[];
  urlsToIgnore: string[];
}): Filters | undefined => {
  const versionFacetFilters = filters.filter(
    (f) => f.facet === "version.title"
  );
  const productFacetFilters = filters.filter(
    (f) => f.facet === "product.title"
  );

  const documentIdFilters: FilterCondition[] = buildNegationFilters(
    "id",
    documentIdsToIgnore
  );
  const urlFilters: FilterCondition[] = buildNegationFilters(
    "url",
    urlsToIgnore
  );

  const versionFilters = versionFacetFilters.map((f) => {
    const filter: Filters = [
      "Or",
      [
        // TODO(eden): facet filters modify the case of the value (which leads to mismatches with the
        // display name property (e.g., V1 -> v1)). Remove when we have a better way to handle this.
        ["version", "Eq", f.value],
        ["version", "Eq", f.value.toUpperCase()],
        ["version", "Eq", f.value.toLowerCase()],
        ["version", "Eq", null],
      ],
    ];
    return filter;
  });

  const productFilters = productFacetFilters.map((f) => {
    const filter: Filters = [
      "Or",
      [
        ["product", "Eq", f.value],
        ["product", "Eq", null],
      ],
    ];
    return filter;
  });

  const queryFilters: Filters | undefined =
    versionFacetFilters.length > 0 || productFacetFilters.length > 0
      ? [
          "And",
          [
            ...versionFilters,
            ...productFilters,
            ...documentIdFilters,
            ...urlFilters,
          ],
        ]
      : documentIdFilters.length > 0
        ? documentIdFilters.length === 1
          ? documentIdFilters[0]
          : ["And", documentIdFilters]
        : undefined;

  return queryFilters;
};
