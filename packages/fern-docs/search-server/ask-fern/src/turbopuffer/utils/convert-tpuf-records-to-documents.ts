import { uniqBy } from "es-toolkit/array";

import { TurbopufferRecord } from "../types";

export function convertTpufRecordToCitation(results: TurbopufferRecord[]) {
  return results.map((result) => {
    return {
      type: "file",
      data: `# ${result.attributes.title}\n\n${result.attributes.document}`,
      mediaType: "text/plain",
      filename: result.attributes.url,
    };
  });
}

function maybeTruncate(text: string, maxLength: number): string {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
}

export function convertTpufRecordsToDocuments(
  results: TurbopufferRecord[]
): string[] {
  return uniqBy(
    results.map((result) => {
      return {
        document: result.attributes.document,
        title: result.attributes.title,
        url: result.attributes.url,
      };
    }),
    (result) => result.url
  ).map(
    (result) =>
      `# ${result.title}\n Citation URL: ${result.url}\n\n${maybeTruncate(result.document, 20000)}`
  );
}
