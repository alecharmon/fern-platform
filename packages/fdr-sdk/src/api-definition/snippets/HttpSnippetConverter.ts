import { type HarRequest, HTTPSnippet, type TargetId } from "httpsnippet-lite";

import { HTTP_SNIPPET_CLIENTS } from "./constants";

const IMPORT_PREFIXES: Partial<Record<TargetId, string>> = {
    csharp: "using RestSharp;\n\n",
    java: "import com.mashape.unirest.http.HttpResponse;\nimport com.mashape.unirest.http.Unirest;\n\n"
};

const PHP_AUTOLOAD_INSERT = "\nrequire_once('vendor/autoload.php');\n";

export class HttpSnippetConverter {
    private readonly snippet: HTTPSnippet;

    constructor(harRequest: HarRequest) {
        this.snippet = new HTTPSnippet(harRequest);
    }

    async convert(targetId: TargetId, clientId: string): Promise<string | undefined> {
        const convertedCode = await this.snippet.convert(targetId, clientId);
        const raw =
            typeof convertedCode === "string" ? convertedCode : convertedCode != null ? convertedCode[0] : undefined;

        if (raw == null) {
            return undefined;
        }

        return this.addImports(raw, targetId);
    }

    async convertAll(): Promise<{ targetId: TargetId; code: string }[]> {
        const results: { targetId: TargetId; code: string }[] = [];

        for (const { targetId, clientId } of HTTP_SNIPPET_CLIENTS) {
            const code = await this.convert(targetId, clientId);
            if (code != null) {
                results.push({ targetId, code });
            }
        }

        return results;
    }

    private addImports(code: string, targetId: TargetId): string {
        if (targetId === "php") {
            return code.replace(/^<\?php\n/, `<?php${PHP_AUTOLOAD_INSERT}`);
        }

        const prefix = IMPORT_PREFIXES[targetId];
        if (prefix != null) {
            return `${prefix}${code}`;
        }

        return code;
    }
}
