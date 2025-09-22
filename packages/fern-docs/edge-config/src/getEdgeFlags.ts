import type { EdgeFlags } from "@fern-api/docs-utils";
import {
  DEFAULT_EDGE_FLAGS,
  DEFAULT_SELF_HOSTED_EDGE_FLAGS,
  isCustomDomain,
  isDevelopment,
  isFern,
  withoutStaging,
} from "@fern-api/docs-utils";

import { getAllEdge } from "./getEdge";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

const EDGE_FLAGS = [
  "api-playground-enabled" as const,
  "api-scrolling-disabled" as const,
  "whitelabeled" as const,
  "seo-disabled" as const,
  "seo-enabled" as const,
  "toc-default-enabled" as const,
  "snippet-template-enabled" as const,
  "http-snippets-enabled" as const,
  "inline-feedback-enabled" as const,
  "dark-code-enabled" as const,
  "disable-proxy" as const,
  "image-zoom-disabled" as const,
  "use-javascript-as-typescript" as const,
  "always-enable-javascript-fetch" as const,
  "scroll-in-container-enabled" as const,
  "batch-stream-toggle-disabled" as const,
  "enabled-auth-in-generated-docs" as const,
  "audio-file-download-span-summary" as const,
  "docs-logo-text-enabled" as const,
  "audio-example-internal" as const,
  "uses-application-json-in-form-data-value" as const,
  "binary-octet-stream-audio-player" as const,
  "cohere-theme" as const,
  "file-forge-hack-enabled" as const,
  "hide-404-page" as const,
  "new-search-experience" as const,
  "grpc-endpoints" as const,
  "authenticated-pages-discoverable" as const,
  "search-v2" as const,
  "authed-previews" as const,
  "search-disabled" as const,
  "default-search-filter-on" as const,
  "changelog-redirects" as const,
  "posthog-disabled" as const,
  "next-mdx-ref" as const,
  "llms-txt-disabled" as const,
  "dynamic-snippets" as const,
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

    const isApiPlaygroundEnabled = checkDomainMatchesCustomers(
      domain,
      config["api-playground-enabled"]
    );
    const isApiScrollingDisabled = checkDomainMatchesCustomers(
      domain,
      config["api-scrolling-disabled"]
    );
    const isWhitelabeled = checkDomainMatchesCustomers(
      domain,
      config.whitelabeled
    );
    const isSeoDisabled = checkDomainMatchesCustomers(
      domain,
      config["seo-disabled"]
    );
    const isSeoEnabled = checkDomainMatchesCustomers(
      domain,
      config["seo-enabled"]
    );
    const isTocDefaultEnabled = checkDomainMatchesCustomers(
      domain,
      config["toc-default-enabled"]
    );
    const isSnippetTemplatesEnabled = checkDomainMatchesCustomers(
      domain,
      config["snippet-template-enabled"]
    );
    const isHttpSnippetsEnabled = checkDomainMatchesCustomers(
      domain,
      config["http-snippets-enabled"]
    );
    const isInlineFeedbackEnabled = checkDomainMatchesCustomers(
      domain,
      config["inline-feedback-enabled"]
    );
    const isDarkCodeEnabled = checkDomainMatchesCustomers(
      domain,
      config["dark-code-enabled"]
    );
    const isProxyDisabled = checkDomainMatchesCustomers(
      domain,
      config["disable-proxy"]
    );
    const isImageZoomDisabled = checkDomainMatchesCustomers(
      domain,
      config["image-zoom-disabled"]
    );
    const useJavaScriptAsTypeScript = checkDomainMatchesCustomers(
      domain,
      config["use-javascript-as-typescript"]
    );
    const alwaysEnableJavaScriptFetch = checkDomainMatchesCustomers(
      domain,
      config["always-enable-javascript-fetch"]
    );
    const scrollInContainerEnabled = checkDomainMatchesCustomers(
      domain,
      config["scroll-in-container-enabled"]
    );
    const isBatchStreamToggleDisabled = checkDomainMatchesCustomers(
      domain,
      config["batch-stream-toggle-disabled"]
    );
    const isAuthEnabledInDocs = checkDomainMatchesCustomers(
      domain,
      config["enabled-auth-in-generated-docs"]
    );
    const isAudioFileDownloadSpanSummary = checkDomainMatchesCustomers(
      domain,
      config["audio-file-download-span-summary"]
    );
    const isDocsLogoTextEnabled = checkDomainMatchesCustomers(
      domain,
      config["docs-logo-text-enabled"]
    );
    const isAudioExampleInternal = checkDomainMatchesCustomers(
      domain,
      config["audio-example-internal"]
    );
    const usesApplicationJsonInFormDataValue = checkDomainMatchesCustomers(
      domain,
      config["uses-application-json-in-form-data-value"]
    );
    const isBinaryOctetStreamAudioPlayer = checkDomainMatchesCustomers(
      domain,
      config["binary-octet-stream-audio-player"]
    );
    const isCohereTheme = checkDomainMatchesCustomers(
      domain,
      config["cohere-theme"]
    );
    const isFileForgeHackEnabled = checkDomainMatchesCustomers(
      domain,
      config["file-forge-hack-enabled"]
    );
    const is404PageHidden = checkDomainMatchesCustomers(
      domain,
      config["hide-404-page"]
    );
    const isNewSearchExperienceEnabled = checkDomainMatchesCustomers(
      domain,
      config["new-search-experience"]
    );
    const isAuthenticatedPagesDiscoverable = checkDomainMatchesCustomers(
      domain,
      config["authenticated-pages-discoverable"]
    );
    const isSearchV2Enabled =
      domain === "buildwithfern.com"
        ? true
        : checkDomainMatchesCustomers(domain, config["search-v2"]);
    const isAuthedPreview = checkDomainMatchesCustomers(
      domain,
      config["authed-previews"]
    );
    const isSearchDisabled = checkDomainMatchesCustomers(
      domain,
      config["search-disabled"]
    );
    const isDefaultSearchFilterOn = checkDomainMatchesCustomers(
      domain,
      config["default-search-filter-on"]
    );
    const isChangelogRedirects = checkDomainMatchesCustomers(
      domain,
      config["changelog-redirects"]
    );
    const isPosthogDisabled = checkDomainMatchesCustomers(
      domain,
      config["posthog-disabled"]
    );
    const isNextMdxRef = checkDomainMatchesCustomers(
      domain,
      config["next-mdx-ref"]
    );
    const isLlmsTxtDisabled = checkDomainMatchesCustomers(
      domain,
      config["llms-txt-disabled"]
    );
    const isDynamicSnippetsEnabled = checkDomainMatchesCustomers(
      domain,
      config["dynamic-snippets"]
    );
    return {
      isApiPlaygroundEnabled: isDevelopment(domain) || isApiPlaygroundEnabled,
      isApiScrollingDisabled,
      isWhitelabeled,
      isSeoDisabled:
        (!isCustomDomain(domain) && !isSeoEnabled) || isSeoDisabled,
      isTocDefaultEnabled,
      isSnippetTemplatesEnabled:
        isSnippetTemplatesEnabled || isDevelopment(domain),
      isHttpSnippetsEnabled,
      isInlineFeedbackEnabled,
      isDarkCodeEnabled,
      isProxyDisabled,
      isImageZoomDisabled,
      useJavaScriptAsTypeScript,
      alwaysEnableJavaScriptFetch,
      scrollInContainerEnabled,
      isBatchStreamToggleDisabled,
      isAuthEnabledInDocs,
      isAudioFileDownloadSpanSummary,
      isDocsLogoTextEnabled,
      isAudioExampleInternal,
      usesApplicationJsonInFormDataValue,
      isBinaryOctetStreamAudioPlayer,
      isCohereTheme,
      isFileForgeHackEnabled,
      is404PageHidden,
      isNewSearchExperienceEnabled,
      isAuthenticatedPagesDiscoverable,
      isSearchV2Enabled,
      isAuthedPreview,
      isSearchDisabled,
      isDefaultSearchFilterOn,
      isChangelogRedirects,
      isPosthogDisabled,
      isNextMdxRef,
      isLlmsTxtDisabled,
      isDynamicSnippetsEnabled,
    };
  } catch (e) {
    console.error(`[get-edge-flags] ${JSON.stringify(e)}`);
    return {
      isApiPlaygroundEnabled: isDevelopment(domain),
      isApiScrollingDisabled: false,
      isWhitelabeled: false,
      isSeoDisabled: !isCustomDomain(domain),
      isTocDefaultEnabled: false,
      isSnippetTemplatesEnabled: isDevelopment(domain),
      isHttpSnippetsEnabled: false,
      isInlineFeedbackEnabled: isFern(domain),
      isDarkCodeEnabled: false,
      isProxyDisabled: false,
      isImageZoomDisabled: false,
      useJavaScriptAsTypeScript: false,
      alwaysEnableJavaScriptFetch: false,
      scrollInContainerEnabled: false,
      isBatchStreamToggleDisabled: false,
      isAuthEnabledInDocs: false,
      isAudioFileDownloadSpanSummary: false,
      isDocsLogoTextEnabled: false,
      isAudioExampleInternal: false,
      usesApplicationJsonInFormDataValue: false,
      isBinaryOctetStreamAudioPlayer: false,
      isCohereTheme: false,
      isFileForgeHackEnabled: false,
      is404PageHidden: false,
      isNewSearchExperienceEnabled: false,
      isAuthenticatedPagesDiscoverable: false,
      isSearchV2Enabled: domain === "buildwithfern.com",
      isAuthedPreview: false,
      isSearchDisabled: false,
      isDefaultSearchFilterOn: false,
      isChangelogRedirects: false,
      isPosthogDisabled: false,
      isNextMdxRef: false,
      isLlmsTxtDisabled: false,
      isDynamicSnippetsEnabled: false,
    };
  }
}
function checkDomainMatchesCustomers(
  domain: string,
  customers?: readonly string[] | Record<string, unknown>
): boolean {
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
      customers.some((customer) =>
        domainWithoutDocs.toLowerCase().includes(customer.toLowerCase())
      ) ||
      customers.includes(domain) ||
      customers.includes(withoutStaging(domain))
    );
  } else {
    return (
      Object.keys(customers).some((key) =>
        domainWithoutDocs.toLowerCase().includes(key.toLowerCase())
      ) ||
      domain in customers ||
      withoutStaging(domain) in customers
    );
  }
}
