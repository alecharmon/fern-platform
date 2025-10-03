export const getBaseDocsUrl = (docsUrl: string): string => {
    if (docsUrl.includes("%2F")) {
        return docsUrl.split("%2F")[0] ?? "";
    }
    return docsUrl;
};
