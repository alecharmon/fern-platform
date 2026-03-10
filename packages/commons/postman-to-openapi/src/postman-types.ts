/**
 * Postman Collection v2.1 type definitions.
 * Based on https://schema.postman.com/collection/json/v2.1.0/draft-07/collection.json
 */

export interface PostmanCollection {
    info: PostmanInfo;
    item: PostmanItemOrGroup[];
    event?: PostmanEvent[];
    variable?: PostmanVariable[];
    auth?: PostmanAuth | null;
    protocolProfileBehavior?: Record<string, unknown>;
}

export interface PostmanInfo {
    name: string;
    _postman_id?: string;
    description?: PostmanDescription;
    version?: string;
    schema?: string;
}

export type PostmanDescription = string | PostmanDescriptionObject | null;

export interface PostmanDescriptionObject {
    content?: string;
    type?: string;
    version?: string;
}

export type PostmanItemOrGroup = PostmanItem | PostmanItemGroup;

export interface PostmanItem {
    id?: string;
    name?: string;
    description?: PostmanDescription;
    variable?: PostmanVariable[];
    event?: PostmanEvent[];
    request: PostmanRequest | string;
    response?: PostmanResponse[];
    protocolProfileBehavior?: Record<string, unknown>;
}

export interface PostmanItemGroup {
    id?: string;
    name?: string;
    description?: PostmanDescription;
    variable?: PostmanVariable[];
    item: PostmanItemOrGroup[];
    auth?: PostmanAuth | null;
    event?: PostmanEvent[];
    protocolProfileBehavior?: Record<string, unknown>;
}

export function isItemGroup(item: PostmanItemOrGroup): item is PostmanItemGroup {
    return "item" in item && Array.isArray((item as PostmanItemGroup).item);
}

export interface PostmanRequest {
    url?: PostmanUrl | string;
    auth?: PostmanAuth | null;
    method?: string;
    description?: PostmanDescription;
    header?: PostmanHeader[] | string;
    body?: PostmanBody | null;
}

export type PostmanUrl = {
    raw?: string;
    protocol?: string;
    host?: string[] | string;
    path?: (string | { type?: string; value?: string })[];
    port?: string;
    query?: PostmanQueryParam[];
    hash?: string;
    variable?: PostmanVariable[];
};

export interface PostmanQueryParam {
    key?: string | null;
    value?: string | null;
    disabled?: boolean;
    description?: PostmanDescription;
}

export interface PostmanHeader {
    key: string;
    value: string;
    disabled?: boolean;
    description?: PostmanDescription;
}

export interface PostmanBody {
    mode?: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
    raw?: string;
    urlencoded?: PostmanUrlEncodedParam[];
    formdata?: PostmanFormDataParam[];
    file?: { src?: string | null; content?: string };
    graphql?: { query?: string; variables?: string };
    options?: {
        raw?: { language?: string };
    };
    disabled?: boolean;
}

export interface PostmanUrlEncodedParam {
    key: string;
    value?: string;
    disabled?: boolean;
    description?: PostmanDescription;
    type?: string;
}

export interface PostmanFormDataParam {
    key: string;
    value?: string;
    src?: string | string[];
    disabled?: boolean;
    type?: "text" | "file";
    contentType?: string;
    description?: PostmanDescription;
}

export interface PostmanResponse {
    id?: string;
    name?: string;
    originalRequest?: PostmanRequest;
    responseTime?: number | string | null;
    timings?: Record<string, unknown> | null;
    header?: PostmanHeader[] | string | null;
    cookie?: unknown[];
    body?: string;
    status?: string;
    code?: number;
    _postman_previewlanguage?: string;
    _postman_previewtype?: string;
}

export interface PostmanAuth {
    type: PostmanAuthType;
    noauth?: unknown;
    apikey?: PostmanAuthAttribute[];
    awsv4?: PostmanAuthAttribute[];
    basic?: PostmanAuthAttribute[];
    bearer?: PostmanAuthAttribute[];
    digest?: PostmanAuthAttribute[];
    edgegrid?: PostmanAuthAttribute[];
    hawk?: PostmanAuthAttribute[];
    ntlm?: PostmanAuthAttribute[];
    oauth1?: PostmanAuthAttribute[];
    oauth2?: PostmanAuthAttribute[];
}

export type PostmanAuthType =
    | "apikey"
    | "awsv4"
    | "basic"
    | "bearer"
    | "digest"
    | "edgegrid"
    | "hawk"
    | "noauth"
    | "oauth1"
    | "oauth2"
    | "ntlm";

export interface PostmanAuthAttribute {
    key: string;
    value?: unknown;
    type?: string;
}

export interface PostmanVariable {
    id?: string;
    key?: string;
    value?: unknown;
    type?: string;
    name?: string;
    description?: PostmanDescription;
    system?: boolean;
    disabled?: boolean;
}

export interface PostmanEvent {
    id?: string;
    listen: string;
    script?: PostmanScript;
    disabled?: boolean;
}

export interface PostmanScript {
    id?: string;
    type?: string;
    exec?: string[] | string;
    src?: PostmanUrl | string;
    name?: string;
}
