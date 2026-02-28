import { HEADER_X_FERN_HOST } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { headers } from "next/headers";

function cleanHost(host: string | null | undefined): string | undefined {
    if (typeof host !== "string") {
        return undefined;
    }
    const first = host.includes(",") ? host.split(",")[0] : host;
    const trimmed = first?.trim();
    if (!trimmed || trimmed.includes("localhost") || /\d+\.\d+\.\d+\.\d+/.test(trimmed)) {
        return undefined;
    }
    const withoutProtocol = trimmed.includes("://") ? trimmed.split("://")[1] : trimmed;
    if (withoutProtocol == null) {
        return undefined;
    }
    return withoutProtocol.endsWith("/") ? withoutProtocol.slice(0, -1) : withoutProtocol;
}

function getNextPublicDocsDomain(): string | undefined {
    const domain = process.env.NEXT_PUBLIC_DOCS_DOMAIN;
    if (domain == null || domain === "ROOT") {
        return undefined;
    }
    try {
        return new URL(withDefaultProtocol(domain)).host;
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
