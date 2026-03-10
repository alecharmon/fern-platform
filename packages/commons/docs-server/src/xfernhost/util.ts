// Characters that should never appear in a valid hostname.
// Blocks shell metacharacters, injection payloads, and other
// dangerous characters from being accepted via x-fern-host header
// and stored as Redis keys.
const DANGEROUS_CHARS = new Set([
    "{",
    "}",
    "[",
    "]",
    "!",
    "@",
    "#",
    "$",
    "%",
    "^",
    "&",
    "*",
    "(",
    ")",
    "/",
    "\\",
    "<",
    ">",
    ";",
    '"',
    "'",
    "`",
    " ",
    "\t",
    "\n",
    "\r",
    "?",
    "=",
    "+",
    "|",
    "~"
]);

// RFC 1035: full domain names are limited to 253 ASCII characters
const MAX_HOST_LENGTH = 253;

export function cleanHost(host: string | null | undefined): string | undefined {
    if (typeof host !== "string") {
        return undefined;
    }

    // handle case where host might contain multiple domains separated by commas
    if (host.includes(",")) {
        host = host.split(",")[0];
    }

    if (typeof host !== "string") {
        return undefined;
    }

    host = host.trim();

    // host should not be localhost
    if (host.includes("localhost")) {
        return undefined;
    }

    // host should not be an ip address
    if (host.match(/\d+\.\d+\.\d+\.\d+/)) {
        return undefined;
    }

    // strip `http://` or `https://` from the host, if present
    if (host.includes("://")) {
        host = host.split("://")[1];
    }

    // strip trailing slash from the host, if present
    if (host?.endsWith("/")) {
        host = host.slice(0, -1);
    }

    if (host == null || host === "") {
        return undefined;
    }

    if (host.length > MAX_HOST_LENGTH) {
        return undefined;
    }

    // allow %2F (percent-encoded slash for basepath domains like example.com%2Frepo)
    // but reject all other % sequences which could encode dangerous characters
    const normalized = host.replace(/%2F/gi, "");
    for (const char of normalized) {
        if (DANGEROUS_CHARS.has(char)) {
            return undefined;
        }
    }

    return host;
}
