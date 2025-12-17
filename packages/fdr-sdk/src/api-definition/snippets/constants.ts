import type { HTTPSnippetClient } from "./types";

/**
 * HTTP snippet client configurations for each supported language.
 * These define which httpsnippet-lite target and client to use for each language.
 */
export const HTTP_SNIPPET_CLIENTS: HTTPSnippetClient[] = [
    { targetId: "python", clientId: "requests" },
    { targetId: "javascript", clientId: "fetch" },
    { targetId: "go", clientId: "native" },
    { targetId: "ruby", clientId: "native" },
    { targetId: "java", clientId: "unirest" },
    { targetId: "php", clientId: "guzzle" },
    { targetId: "csharp", clientId: "restsharp" },
    { targetId: "swift", clientId: "nsurlsession" }
];
