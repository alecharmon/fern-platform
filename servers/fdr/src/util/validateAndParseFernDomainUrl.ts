import { ORPCError } from "@orpc/server";
import type { FdrApplication } from "../app";
import { ParsedBaseUrl } from "./ParsedBaseUrl";

export default function validateAndParseFernDomainUrl({
    app,
    url
}: {
    app: FdrApplication;
    url: string;
}): ParsedBaseUrl {
    const baseUrl = ParsedBaseUrl.parse(url);
    if (baseUrl.path != null && pathnameIsMalformed(baseUrl.path)) {
        throw new ORPCError("BAD_REQUEST", {
            message: `Domain URL is malformed: https://${baseUrl.hostname + baseUrl.path}`
        });
    }
    if (!baseUrl.hostname.endsWith(app.config.domainSuffix)) {
        throw new ORPCError("BAD_REQUEST", { message: "Invalid custom domain" });
    }
    return baseUrl;
}

function pathnameIsMalformed(pathname: string): boolean {
    if (pathname === "" || pathname === "/") {
        return false;
    }
    if (!/^.*([a-z0-9]).*$/.test(pathname)) {
        // does the pathname only contain special characters?
        return true;
    }
    return false;
}
