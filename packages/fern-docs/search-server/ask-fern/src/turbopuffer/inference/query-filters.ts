import {
  FilterCondition,
  FilterConnective,
  FilterOperator,
  Filters,
} from "@turbopuffer/turbopuffer";

import { EVERYONE_ROLE } from "@fern-api/docs-utils";
import { FacetFilter } from "@fern-docs/search-keyword";

export function buildNegationFilters(
  field: string,
  values: string[] = []
): FilterCondition[] {
  return values.map((v) => [field, "NotEq", v]);
}

export function buildInclusionFilters(
  field: string,
  values: string[] = []
): FilterCondition[] {
  return values.map((v) => [field, "Eq", v]);
}

export const buildQueryFilters = ({
  filters,
  explodedRoles,
  documentIdsToIgnore,
  urlsToIgnore,
  documentUrls,
}: {
  filters: FacetFilter[];
  explodedRoles: string[];
  documentIdsToIgnore: string[];
  urlsToIgnore: string[];
  documentUrls?: string[];
}): Filters | undefined => {
  const versionFacetFilters = filters.filter(
    (f) => f.facet === "version.title"
  );
  const productFacetFilters = filters.filter(
    (f) => f.facet === "product.title"
  );

  const documentIdNegationFilters: FilterCondition[] = buildNegationFilters(
    "id",
    documentIdsToIgnore
  );
  const urlNegationFilters: FilterCondition[] = buildNegationFilters(
    "url",
    urlsToIgnore
  );

  const urlInclusionFilters: FilterCondition[] = documentUrls?.length
    ? buildInclusionFilters("url", documentUrls)
    : [];

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

  const productFilters: [FilterConnective, Filters[]][] =
    productFacetFilters.map((f) => {
      const filter: Filters = [
        "Or",
        [
          ["product", "Eq", f.value],
          ["product", "Eq", null],
        ],
      ];
      return filter;
    });

  const hasDocumentConstraints = urlInclusionFilters.length > 0;

  const rolesToFilter = explodedRoles.includes(EVERYONE_ROLE)
    ? explodedRoles
    : [...explodedRoles, EVERYONE_ROLE];
  const roleFilters: [FilterConnective, Filters[]] = [
    "Or",
    [
      ...rolesToFilter.map((role) => [
        "roles",
        "Contains" as unknown as FilterOperator,
        role,
      ]),
      ["roles", "Eq", null],
    ] as Filters[],
  ];

  const queryFilters: Filters | undefined =
    hasDocumentConstraints && urlInclusionFilters.length > 0
      ? [
          "And",
          [
            ["Or", [...urlInclusionFilters]],
            ...versionFilters,
            ...productFilters,
            roleFilters,
          ],
        ]
      : [
          "And",
          [
            ...versionFilters,
            ...productFilters,
            roleFilters,
            ...documentIdNegationFilters,
            ...urlNegationFilters,
          ],
        ];

  return queryFilters;
};
