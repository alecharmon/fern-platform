import { cleanHost } from "@fern-api/docs-server";
import { HEADER_X_FERN_HOST } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { headers } from "next/headers";

function getNextPublicDocsDomain(): string | undefined {
    const domain = process.env.NEXT_PUBLIC_DOCS_DOMAIN;
    if (domain == null || domain === "ROOT") {
        return undefined;
    }
    try {
        const url = new URL(withDefaultProtocol(domain));
        const basepath = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
        if (basepath) {
            return `${url.host}${basepath.replace(/\//g, "%2F")}`;
        }
        return url.host;
    } catch {
        return undefined;
    }
}

export async function getDocsDomainApp(): Promise<string> {
    const headersList = await headers();
    const hosts = [getNextPublicDocsDomain(), headersList.get(HEADER_X_FERN_HOST), headersList.get("host")];
    for (const host of hosts) {
        const cleaned = cleanHost(host);
        if (cleaned != null) {
            return cleaned;
        }
    }
    return "buildwithfern.com";
}

export async function getDocsHostApp(): Promise<string> {
    const headersList = await headers();
    return headersList.get("host") ?? (await getDocsDomainApp());
}
