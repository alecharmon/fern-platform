import type { EdgeFlags } from "@fern-api/docs-utils";
import {
    DEFAULT_EDGE_FLAGS,
    DEFAULT_SELF_HOSTED_EDGE_FLAGS,
    isCustomDomain,
    isFern,
    withoutStaging
} from "@fern-api/docs-utils";

import { getAllEdge } from "./getEdge";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

const EDGE_FLAGS = [
    "whitelabeled" as const,
    "seo-disabled" as const,
    "seo-enabled" as const,
    "inline-feedback-enabled" as const,
    "dark-code-enabled" as const,
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
    "default-search-filter-on" as const,
    "changelog-redirects" as const,
    "next-mdx-ref" as const,
    "dynamic-snippets" as const,
    "custom-react-enabled" as const,
    "discriminated-union-dropdown-enabled" as const,
    "trailing-slash" as const
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
        const isInlineFeedbackEnabled = checkDomainMatchesCustomers(domain, config["inline-feedback-enabled"]);
        const isDarkCodeEnabled = checkDomainMatchesCustomers(domain, config["dark-code-enabled"]);
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
        const isDefaultSearchFilterOn = checkDomainMatchesCustomers(domain, config["default-search-filter-on"]);
        const isChangelogRedirects = checkDomainMatchesCustomers(domain, config["changelog-redirects"]);
        const isNextMdxRef = checkDomainMatchesCustomers(domain, config["next-mdx-ref"]);
        const isCustomReactEnabled = checkDomainMatchesCustomers(domain, config["custom-react-enabled"]);
        const isDiscriminatedUnionDropdownEnabled = checkDomainMatchesCustomers(
            domain,
            config["discriminated-union-dropdown-enabled"]
        );
        const isTrailingSlashEnabled = checkDomainMatchesCustomers(domain, config["trailing-slash"]);
        return {
            isWhitelabeled,
            isSeoDisabled: (!isCustomDomain(domain) && !isSeoEnabled) || isSeoDisabled,
            isInlineFeedbackEnabled,
            isDarkCodeEnabled,
            isImageZoomDisabled,
            isBatchStreamToggleDisabled,
            isAudioFileDownloadSpanSummary,
            isAudioExampleInternal,
            isCohereTheme,
            is404PageHidden,
            isAuthenticatedPagesDiscoverable,
            isAuthedPreview,
            isDefaultSearchFilterOn,
            isChangelogRedirects,
            isNextMdxRef,
            isCustomReactEnabled,
            isDiscriminatedUnionDropdownEnabled,
            isTrailingSlashEnabled
        };
    } catch (e) {
        console.error(`[get-edge-flags] ${JSON.stringify(e)}`);
        return {
            isWhitelabeled: false,
            isSeoDisabled: !isCustomDomain(domain),
            isInlineFeedbackEnabled: isFern(domain),
            isDarkCodeEnabled: false,
            isImageZoomDisabled: false,
            isBatchStreamToggleDisabled: false,
            isAudioFileDownloadSpanSummary: false,
            isAudioExampleInternal: false,
            isCohereTheme: false,
            is404PageHidden: false,
            isAuthenticatedPagesDiscoverable: false,
            isAuthedPreview: false,
            isDefaultSearchFilterOn: false,
            isChangelogRedirects: false,
            isNextMdxRef: false,
            isCustomReactEnabled: false,
            isDiscriminatedUnionDropdownEnabled: false,
            isTrailingSlashEnabled: false
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
            customers.includes(withoutStaging(domain))
        );
    } else {
        return (
            Object.keys(customers).some((key) => domainWithoutDocs.toLowerCase().includes(key.toLowerCase())) ||
            domain in customers ||
            withoutStaging(domain) in customers
        );
    }
}
