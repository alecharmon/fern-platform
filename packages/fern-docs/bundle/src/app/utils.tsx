import { createCachedDocsLoader } from "@fern-api/docs-loader";

export interface HtmlOptions {
    content: string;
    host?: string;
    domain?: string;
    title?: string;
}

export async function generateHtml({ content, host, domain, title }: HtmlOptions): Promise<string> {
    let faviconUrl: string | undefined;

    const loader = host && domain ? await createCachedDocsLoader(host, domain) : undefined;

    if (loader) {
        const [config, files] = await Promise.all([loader.getConfig(), loader.getFiles()]);

        if (config.favicon) {
            faviconUrl = files[config.favicon]?.src;
        }
    }

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    ${title ? `<title>${title}</title>` : ""}
    ${faviconUrl ? `<link rel="icon" href="${faviconUrl}" />` : ""}
  </head>
  <body>
    <pre>${content}</pre>
  </body>
</html>`;
}

export type ModelProvider = "anthropic" | "cohere";
