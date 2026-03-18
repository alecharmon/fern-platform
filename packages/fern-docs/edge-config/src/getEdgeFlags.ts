import type { EdgeFlags } from "@fern-api/docs-utils";
import {
    DEFAULT_EDGE_FLAGS,
    DEFAULT_SELF_HOSTED_EDGE_FLAGS,
    isCustomDomain,
    toProductionDomain,
    withoutStaging
} from "@fern-api/docs-utils";
import { logger } from "@fern-api/ui-core-utils";

import { getAllEdge } from "./getEdge";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

const EDGE_FLAGS = [
    "whitelabeled" as const,
    "seo-disabled" as const,
    "seo-enabled" as const,
    "disable-proxy" as const,
    "image-zoom-disabled" as const,
    "batch-stream-toggle-disabled" as const,
    "audio-file-download-span-summary" as const,
    "audio-example-internal" as const,
    "cohere-theme" as const,
    "hide-404-page" as const,
    "grpc-endpoints" as const,
    "authenticated-pages-discoverable" as const,
    "authed-previews" as const,

    "next-mdx-ref" as const,
    "dynamic-snippets" as const,
    "custom-react-enabled" as const,
    "discriminated-union-dropdown-enabled" as const,
    "search-across-all-basepaths" as const,
    "use-remote-mdx-renderer" as const
];

type EdgeFlag = (typeof EDGE_FLAGS)[number];

type EdgeConfigResponse = Record<EdgeFlag, string[] | Record<string, unknown>>;

export async function getEdgeFlags(domain: string): Promise<EdgeFlags> {
    if (isLocal()) {
        return DEFAULT_EDGE_FLAGS;
    } else if (isSelfHosted()) {
        return DEFAULT_SELF_HOSTED_EDGE_FLAGS;
    }

    try {
        const config = await getAllEdge<EdgeConfigResponse>(EDGE_FLAGS);
        if (config === undefined) {
            throw new Error("Failed to fetch edge config");
        }

        const isWhitelabeled = checkDomainMatchesCustomers(domain, config.whitelabeled);
        const isSeoDisabled = checkDomainMatchesCustomers(domain, config["seo-disabled"]);
        const isSeoEnabled = checkDomainMatchesCustomers(domain, config["seo-enabled"]);
        const isImageZoomDisabled = checkDomainMatchesCustomers(domain, config["image-zoom-disabled"]);
        const isBatchStreamToggleDisabled = checkDomainMatchesCustomers(domain, config["batch-stream-toggle-disabled"]);
        const isAudioFileDownloadSpanSummary = checkDomainMatchesCustomers(
            domain,
            config["audio-file-download-span-summary"]
        );
        const isAudioExampleInternal = checkDomainMatchesCustomers(domain, config["audio-example-internal"]);
        const isCohereTheme = checkDomainMatchesCustomers(domain, config["cohere-theme"]);
        const is404PageHidden = checkDomainMatchesCustomers(domain, config["hide-404-page"]);
        const isAuthenticatedPagesDiscoverable = checkDomainMatchesCustomers(
            domain,
            config["authenticated-pages-discoverable"]
        );
        const isAuthedPreview = checkDomainMatchesCustomers(domain, config["authed-previews"]);

        const isNextMdxRef = checkDomainMatchesCustomers(domain, config["next-mdx-ref"]);
        const isCustomReactEnabled = checkDomainMatchesCustomers(domain, config["custom-react-enabled"]);
        const isDiscriminatedUnionDropdownEnabled = checkDomainMatchesCustomers(
            domain,
            config["discriminated-union-dropdown-enabled"]
        );
        const isSearchAcrossAllBasepaths = checkDomainMatchesCustomers(domain, config["search-across-all-basepaths"]);
        const isRemoteMdxRenderer = checkDomainMatchesCustomers(domain, config["use-remote-mdx-renderer"]);
        return {
            isWhitelabeled,
            isSeoDisabled: (!isCustomDomain(domain) && !isSeoEnabled) || isSeoDisabled,
            isImageZoomDisabled,
            isBatchStreamToggleDisabled,
            isAudioFileDownloadSpanSummary,
            isAudioExampleInternal,
            isCohereTheme,
            is404PageHidden,
            isAuthenticatedPagesDiscoverable,
            isAuthedPreview,
            isNextMdxRef,
            isCustomReactEnabled,
            isDiscriminatedUnionDropdownEnabled,
            isSearchAcrossAllBasepaths,
            isRemoteMdxRenderer
        };
    } catch (e) {
        logger.error(`[get-edge-flags] ${JSON.stringify(e)}`);
        return {
            isWhitelabeled: false,
            isSeoDisabled: !isCustomDomain(domain),
            isImageZoomDisabled: false,
            isBatchStreamToggleDisabled: false,
            isAudioFileDownloadSpanSummary: false,
            isAudioExampleInternal: false,
            isCohereTheme: false,
            is404PageHidden: false,
            isAuthenticatedPagesDiscoverable: false,
            isAuthedPreview: false,
            isNextMdxRef: false,
            isCustomReactEnabled: false,
            isDiscriminatedUnionDropdownEnabled: false,
            isSearchAcrossAllBasepaths: false,
            isRemoteMdxRenderer: false
        };
    }
}
function checkDomainMatchesCustomers(domain: string, customers?: readonly string[] | Record<string, unknown>): boolean {
    if (customers == null) {
        return false;
    }
    const domainWithoutDocs = domain
        .replace(".docs.buildwithfern.com", "")
        .replace(".docs.staging.buildwithfern.com", "")
        .replace(".docs.dev.buildwithfern.com", "")
        .replace(".buildwithfern.dev", "")
        .replace(".ferndocs.dev", "")
        .replace(".ferndocs.app", "")
        .replace(".ferndocs.com", "");

    if (Array.isArray(customers)) {
        return (
            customers.some((customer) => domainWithoutDocs.toLowerCase().includes(customer.toLowerCase())) ||
            customers.includes(domain) ||
            customers.includes(withoutStaging(domain)) ||
            customers.includes(toProductionDomain(domain))
        );
    } else {
        return (
            Object.keys(customers).some((key) => domainWithoutDocs.toLowerCase().includes(key.toLowerCase())) ||
            domain in customers ||
            withoutStaging(domain) in customers ||
            toProductionDomain(domain) in customers
        );
    }
}
