import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { EVERYONE_ROLE } from "@fern-api/docs-utils";
import type { DocsV1Read, DocsV2Read } from "@fern-api/fdr-sdk/client/types";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { FERN_DOCS_ID } from "@fern-docs/components/constants";
import { FeatureFlagProvider } from "@fern-docs/components/feature-flags/FeatureFlagProvider";
import { ScrollToTop } from "@fern-docs/components/layouts/ScrollToTop";
import { ErrorBoundaryProvider } from "@fern-docs/components/providers/ErrorBoundaryProvider";
import { Providers } from "@fern-docs/components/providers/providers";
import { DarkCode } from "@fern-docs/components/state/dark-code";
import { Domain } from "@fern-docs/components/state/domain";
import { EmbeddedProvider } from "@fern-docs/components/state/embedded";
import type { LaunchDarklyInfo } from "@fern-docs/components/state/feature-flags";
import { DefaultLanguage } from "@fern-docs/components/state/language";
import { RootNodeProvider, SetBasePath } from "@fern-docs/components/state/navigation";
import {
    getAllSidebarRootNodes,
    getInitiallyCollapsedNodes,
    getSidebarRootNodeIdToChildToParentsMap
} from "@fern-docs/components/state/navigation-server";
import { FernThemeProvider } from "@fern-docs/components/theme";
import { GlobalStyles } from "@fern-docs/components/theming/global-styles";
import {
    getCustomerAnalytics as deprecated_getCustomerAnalytics,
    getLaunchDarklySettings
} from "@fern-docs/edge-config";
import { getEnv } from "@vercel/functions";
import { compact } from "es-toolkit/array";
import { headers as nextHeaders } from "next/headers";
import Script from "next/script";
import type { Metadata } from "next/types";
import React from "react";
import { preload } from "react-dom";
import { CustomerAnalytics } from "@/components/analytics/CustomerAnalytics";
import { ConsoleMessage } from "@/components/console-message";
import { ErrorBoundary } from "@/components/error-boundary";
import { FernUser } from "@/components/fern-user";
import { JavascriptProvider } from "@/components/JavascriptProvider";
import SearchV2 from "@/components/search";
import { generateMetadataFromConfig } from "@/components/seo";
import { WebSocketRefresh } from "@/components/websocket-refresh";
import { withJsConfig } from "@/components/with-js-config";
import { runAsyncSpan } from "@/server/tracing";
import { SetColors } from "@/state/colors";
import { DiscriminatedUnionDropdownEnabled } from "@/state/discriminated-union-dropdown";
import { SetLogoText } from "@/state/logo-text";
import { SetIsAskAiEnabled, SetIsDefaultSearchFilterOn } from "@/state/search";
import { Whitelabeled } from "@/state/whitelabeled";
import printViewBackgroundStyles from "./print-view-background-overrides.module.css";

export default async function Layout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ host: string; domain: string }>;
}) {
    const { host, domain } = await params;
    const requestHeaders = await nextHeaders();
    const isPrintView = requestHeaders.get("x-fern-print-view") === "1";
    const isLocalEnvironment = isLocal();
    const loader = await createCachedDocsLoader(host, domain, undefined, { roles: [EVERYONE_ROLE] });
    const [
        { basePath },
        config,
        unsafe_fullRoot,
        edgeFlags,
        files,
        colors,
        layout,
        settings,
        theme,
        lang,
        fonts,
        isAskAiEnabled,
        deprecated_customerAnalytics,
        launchDarkly
    ] = await Promise.all([
        loader.getMetadata(),
        loader.getConfig(),
        loader.unsafe_getFullRoot(),
        loader.getEdgeFlags(),
        loader.getFiles(),
        loader.getColors(),
        loader.getLayout(),
        loader.getSettings(),
        loader.getTheme(),
        loader.getLanguage(),
        loader.getFonts(),
        loader.isAskAiEnabledForDocs(),
        deprecated_getCustomerAnalytics(domain),
        getLaunchDarklyInfo(loader)
    ]);

    generatePreloadHrefs(config.typographyV2, files);
    const { VERCEL_ENV } = getEnv();

    const jsConfig = withJsConfig(config.js, files);

    // this creates a safe id mapping, so we can send it to the client:
    const sidebarRootNodes = getAllSidebarRootNodes(unsafe_fullRoot);
    const sidebarRootNodesToChildToParentsMap = getSidebarRootNodeIdToChildToParentsMap(sidebarRootNodes);

    // Get initially collapsed nodes for each sidebar root
    const sidebarRootNodesToInitiallyCollapsedNodes = new Map(
        Array.from(sidebarRootNodes.entries()).map(([nodeId, sidebarRootNode]) => [
            nodeId,
            getInitiallyCollapsedNodes(sidebarRootNode)
        ])
    );

    const cdnOrigin = process.env.NEXT_PUBLIC_CDN_URI ? new URL(process.env.NEXT_PUBLIC_CDN_URI).origin : undefined;

    const headers = (
        <head>
            {/* Preconnect to critical domains for faster resource loading */}
            {cdnOrigin && (
                <>
                    <link rel="preconnect" href={cdnOrigin} crossOrigin="anonymous" />
                    <link rel="dns-prefetch" href={cdnOrigin} />
                </>
            )}
            <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
            <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />

            {/* KaTeX CSS for LaTeX math rendering - pinned version with SRI for supply-chain security */}
            <link
                rel="preload"
                as="style"
                href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
                integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn"
                crossOrigin="anonymous"
            />
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
                integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn"
                crossOrigin="anonymous"
            />
        </head>
    );

    return (
        <html
            lang={lang}
            suppressHydrationWarning
            className={isPrintView ? printViewBackgroundStyles.printHtml : undefined}
        >
            {!isSelfHosted() && headers}
            <body
                className={`antialiased${isPrintView ? ` ${printViewBackgroundStyles.printBody}` : ""}`}
                id={FERN_DOCS_ID}
            >
                <ConsoleMessage />
                <ScrollToTop />
                {isLocalEnvironment && <WebSocketRefresh lang={lang} />}
                <Providers>
                    <FernThemeProvider
                        hasLight={Boolean(colors.light)}
                        hasDark={Boolean(colors.dark)}
                        lightThemeColor={colors.light?.themeColor}
                        darkThemeColor={colors.dark?.themeColor}
                    >
                        <RootNodeProvider
                            sidebarRootNodesToChildToParentsMap={sidebarRootNodesToChildToParentsMap}
                            sidebarRootNodesToInitiallyCollapsedNodes={sidebarRootNodesToInitiallyCollapsedNodes}
                        >
                            <Domain value={domain} />
                            <React.Suspense fallback={null}>
                                <EmbeddedProvider />
                            </React.Suspense>
                            <SetBasePath value={basePath || "/"} />
                            {/**
                             * We only load Vercel Insights and Speed Insights scripts for sites WITHOUT a basePath.
                             * When a site has a basePath (e.g., /docs), we'd want _vercel/* endpoints to include basePath
                             * to properly attribute analytics to the correct site. However, Vercel serves these endpoints
                             * at the domain root, so we disable these scripts for sites with a basePath for now.
                             */}
                            {!isSelfHosted() && !settings.disableAnalytics && !basePath && (
                                <>
                                    <Script data-endpoint="/_vercel/insights" src="/_vercel/insights/script.js" defer />
                                    <Script
                                        data-endpoint="/_vercel/speed-insights/vitals"
                                        src="/_vercel/speed-insights/script.js"
                                        defer
                                    />
                                </>
                            )}
                            {/* TODO: remove cohere hack they've added to docs.yml */}
                            <SetLogoText text={domain.includes("cohere") ? "docs" : config.logoRightText} />
                            {config.defaultLanguage != null && <DefaultLanguage language={config.defaultLanguage} />}
                            <DarkCode value={(edgeFlags.isDarkCodeEnabled || settings.darkModeCode) ?? false} />
                            <Whitelabeled value={edgeFlags.isWhitelabeled} />
                            <DiscriminatedUnionDropdownEnabled value={edgeFlags.isDiscriminatedUnionDropdownEnabled} />
                            <SetColors colors={colors} />
                            <SetIsAskAiEnabled isAskAiEnabled={isAskAiEnabled} />
                            <SetIsDefaultSearchFilterOn
                                isDefaultSearchFilterOn={
                                    edgeFlags.isDefaultSearchFilterOn || (settings.defaultSearchFilters ?? false)
                                }
                            />
                            <FernUser />
                            <GlobalStyles
                                domain={domain}
                                layout={layout}
                                fonts={fonts}
                                light={colors.light}
                                dark={colors.dark}
                                inlineCss={config.css?.inline}
                                theme={theme}
                            />
                            <FeatureFlagProvider featureFlagsConfig={{ launchDarkly }}>
                                <ErrorBoundaryProvider ErrorBoundary={ErrorBoundary}>
                                    <div
                                        data-body-theme={theme?.body}
                                        data-product-switcher-theme={theme?.productSwitcher}
                                    >
                                        {children}
                                    </div>
                                </ErrorBoundaryProvider>
                            </FeatureFlagProvider>
                            <React.Suspense fallback={null}>
                                {!isPrintView && !isLocalEnvironment && !settings.disableSearch && (
                                    <SearchV2
                                        domain={domain}
                                        disableAnalytics={settings.disableAnalytics}
                                        lang={lang}
                                    />
                                )}
                            </React.Suspense>
                            {!isPrintView && jsConfig != null && <JavascriptProvider config={jsConfig} />}
                            {!isPrintView && VERCEL_ENV === "production" && !settings.disableAnalytics && (
                                <CustomerAnalytics
                                    config={mergeCustomerAnalytics(
                                        deprecated_customerAnalytics,
                                        config.analyticsConfig
                                    )}
                                />
                            )}
                        </RootNodeProvider>
                    </FernThemeProvider>
                </Providers>
            </body>
        </html>
    );
}

// TODO: delete this once we've migrated all customers to the new analytics config
function mergeCustomerAnalytics(
    deprecated_customerAnalytics: Awaited<ReturnType<typeof deprecated_getCustomerAnalytics>>,
    config: DocsV1Read.AnalyticsConfig | undefined
): Partial<DocsV1Read.AnalyticsConfig> {
    return {
        ga4: deprecated_customerAnalytics?.ga4?.measurementId
            ? { measurementId: deprecated_customerAnalytics.ga4.measurementId }
            : undefined,
        gtm: deprecated_customerAnalytics?.gtm?.tagId
            ? { containerId: deprecated_customerAnalytics.gtm.tagId }
            : undefined,
        ...config
    };
}

async function getLaunchDarklyInfo(loader: DocsLoader): Promise<LaunchDarklyInfo | undefined> {
    const unstable_launchDarklySettings = await getLaunchDarklySettings(
        loader.domain,
        loader.getMetadata().then((metadata) => metadata.org)
    );
    if (!unstable_launchDarklySettings) {
        return undefined;
    }

    return {
        clientSideId: unstable_launchDarklySettings["client-side-id"],
        contextEndpoint: unstable_launchDarklySettings["context-endpoint"],
        context: undefined,
        defaultFlags: undefined,
        options: {
            baseUrl: unstable_launchDarklySettings.options?.["base-url"],
            streamUrl: unstable_launchDarklySettings.options?.["stream-url"],
            eventsUrl: unstable_launchDarklySettings.options?.["events-url"],
            hash: undefined
        }
    };
}

export async function generateMetadata(props: {
    params: Promise<{ host: string; domain: string }>;
}): Promise<Metadata> {
    return runAsyncSpan("route.layout.generateMetadata", async (span) => {
        const resolvedParams = await props.params;
        span.setAttributes({
            "fern.docs.host": resolvedParams.host,
            "fern.docs.domain": resolvedParams.domain
        });
        return generateMetadataFromConfig({ params: Promise.resolve(resolvedParams) });
    });
}

function generatePreloadHrefs(
    typography: DocsV2Read.LoadDocsForUrlResponse["definition"]["config"]["typographyV2"],
    files: Record<string, { src: string }>
): void {
    compact([typography?.bodyFont?.variants, typography?.headingsFont?.variants, typography?.codeFont?.variants])
        .flat()
        .map((variant) => files[variant.fontFile]?.src)
        .filter(isNonNullish)
        .forEach((src) => {
            try {
                preload(src, {
                    as: "font",
                    crossOrigin: "anonymous",
                    type: `font/${getFontExtension(src)}`,
                    fetchPriority: "high"
                });
            } catch {}
        });
}

function getFontExtension(url: string): string {
    const ext = new URL(url).pathname.split(".").pop();
    if (ext == null) {
        throw new Error("No extension found for font: " + url);
    }
    return ext;
}
