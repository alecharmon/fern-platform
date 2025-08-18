export function getS3KeyForV1DocsDefinition(domain: string): string {
  return `${domain}/v1/fdr.json`;
}

export function getS3KeyForDynamicIr({
  orgName,
  apiName,
  language,
}: {
  orgName: string;
  apiName: string;
  language: string;
}): string {
  return `${orgName}/${apiName}/${language}.json`;
}
