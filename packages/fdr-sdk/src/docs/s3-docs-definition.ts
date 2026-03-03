export function getS3KeyForV1DocsDefinition(domain: string, basepath?: string): string {
    const isLocalMode = process.env.LOCAL_MODE_OVERRIDE === "true";
    if (basepath != null) {
        const cleanBasepath = basepath.replace(/^\//, "");
        return isLocalMode ? `${cleanBasepath}/v1/fdr.json` : `${domain}/${cleanBasepath}/v1/fdr.json`;
    }
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
