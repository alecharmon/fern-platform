import { withoutStaging } from "@fern-api/docs-utils";

export function getTurbopufferNamespace(
  domain: string,
  indexName: string
): string {
  return `${withoutStaging(domain)}_${indexName}`;
}

export function getFernDocsIndexName(): string {
  return `fern_docs`;
}

export function getQueryIndexName(): string {
  return `query`;
}
