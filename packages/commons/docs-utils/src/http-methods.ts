export type HttpMethod = "GET" | "DELETE" | "POST" | "PUT" | "PATCH" | "HEAD" | "OPTIONS" | "CONNECT" | "TRACE";
export const HttpMethod: Record<HttpMethod, HttpMethod> = {
    GET: "GET",
    DELETE: "DELETE",
    POST: "POST",
    PUT: "PUT",
    PATCH: "PATCH",
    HEAD: "HEAD",
    OPTIONS: "OPTIONS",
    CONNECT: "CONNECT",
    TRACE: "TRACE"
} as const;

export type GrpcMethod = "UNARY" | "CLIENT_STREAM" | "SERVER_STREAM" | "BIDIRECTIONAL_STREAM";

export const GrpcMethod: Record<GrpcMethod, GrpcMethod> = {
    UNARY: "UNARY",
    CLIENT_STREAM: "CLIENT_STREAM",
    SERVER_STREAM: "SERVER_STREAM",
    BIDIRECTIONAL_STREAM: "BIDIRECTIONAL_STREAM"
} as const;

export function isGrpcMethod(method: unknown): method is GrpcMethod {
    return typeof method === "string" && Object.prototype.hasOwnProperty.call(GrpcMethod, method);
}

export const HttpMethodOrder = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
    "CONNECT",
    "TRACE"
] as const;

export function isHttpMethod(value: string): value is HttpMethod {
    return HttpMethod[value as keyof typeof HttpMethod] != null;
}

export type WssProtocol = "WSS";

export type HttpOrWssOrGrpc = HttpMethod | WssProtocol | GrpcMethod;
