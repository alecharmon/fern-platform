export function getS3KeyForV1DocsDefinition(domain: string): string {
    // In self-hosted mode, bucket name = domain, so don't duplicate domain in key
    // In cloud mode, we use a shared bucket, so we need domain prefix
    const isLocalMode = process.env.LOCAL_MODE_OVERRIDE === "true";
    return isLocalMode ? "v1/fdr.json" : `${domain}/v1/fdr.json`;
}

export function getS3KeyForDynamicIr({
    orgName,
    apiName,
    language
}: {
    orgName: string;
    apiName: string;
    language: string;
}): string {
    return `${orgName}/${apiName}/${language}.json`;
}
