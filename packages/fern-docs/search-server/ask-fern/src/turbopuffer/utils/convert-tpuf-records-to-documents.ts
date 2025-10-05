import { uniqBy } from "es-toolkit/array";

import type { TurbopufferRecord } from "../types";

export function convertTpufRecordToCitation(results: TurbopufferRecord[]) {
    return results.map((result) => {
        return {
            type: "file",
            data: `# ${result.attributes.title}\n\n${result.attributes.document}`,
            mediaType: "text/plain",
            filename: result.attributes.url
        };
    });
}

function maybeTruncate(text: string, maxLength: number): string {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + "...";
    }
    return text;
}

export function convertTpufRecordsToDocuments(results: TurbopufferRecord[]): string[] {
    return uniqBy(
        results.map((result) => {
            return {
                document: result.attributes.document,
                title: result.attributes.title,
                url: result.attributes.url
            };
        }),
        (result) => result.url
    ).map((result) => {
        if (result.url == null) {
            return maybeTruncate(result.document, 20000);
        }
        return `# ${result.title}\n Citation URL: ${result.url}\n\n${maybeTruncate(result.document, 20000)}`;
    });
}
