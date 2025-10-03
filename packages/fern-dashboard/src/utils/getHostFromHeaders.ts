import { headers } from "next/headers";

export async function getHostFromHeaders() {
    const headersObject = await headers();
    const host = headersObject.get("host");
    if (host == null) {
        throw new Error("Host is not set in headers");
    }
    return host;
}
