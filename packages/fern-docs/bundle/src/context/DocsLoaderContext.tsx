import type { DocsLoader } from "@fern-api/docs-server/docs-loader";

let loaderStore: { loader: DocsLoader; lang: string } | undefined;

export const getDocsLoaderContext = () => loaderStore;

export const setDocsLoaderContext = (loader: DocsLoader, lang: string) => {
    loaderStore = { loader, lang };
};
