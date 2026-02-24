/**
 * This is a type that represents a *decoded* docs url.
 */
export type DocsUrl = string & { __docsUrl: void };

/**
 * This is a type that represents an *encoded* docs url.
 */
export type EncodedDocsUrl = string & { __encodedDocsUrl: void };

export type ResolvedReturnType<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;
