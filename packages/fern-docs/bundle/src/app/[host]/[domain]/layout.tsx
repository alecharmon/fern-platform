import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import type { DocsV1Read, DocsV2Read } from "@fern-api/fdr-sdk/client/types";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { FeatureFlagProvider } from "@fern-docs/components/feature-flags/FeatureFlagProvider";
import { Domain } from "@fern-docs/components/state/domain";
import type { LaunchDarklyInfo } from "@fern-docs/components/state/feature-flags";
import { RootNodeProvider, SetBasePath } from "@fern-docs/components/state/navigation";
import {
    getAllSidebarRootNodes,
    getSidebarRootNodeIdToChildToParentsMap
} from "@fern-docs/components/state/navigation-server";
import { FernThemeProvider } from "@fern-docs/components/theme";
import { GlobalStyles } from "@fern-docs/components/theming/global-styles";
import {
    getCustomerAnalytics as deprecated_getCustomerAnalytics,
    getLaunchDarklySettings
} from "@fern-docs/edge-config";
import { Analytics } from "@vercel/analytics/next";
import { getEnv } from "@vercel/functions";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { compact } from "es-toolkit/array";
import type { Metadata } from "next/types";
import React from "react";
import { preload } from "react-dom";
import { CustomerAnalytics } from "@/components/analytics/CustomerAnalytics";
import { FernUser } from "@/components/fern-user";
import { JavascriptProvider } from "@/components/JavascriptProvider";
import SearchV2 from "@/components/search";
import { generateMetadataFromConfig } from "@/components/seo";
import { withJsConfig } from "@/components/with-js-config";
import { SetColors } from "@/state/colors";
import { DarkCode } from "@/state/dark-code";
import { DefaultLanguage } from "@/state/language";
import { SetLogoText } from "@/state/logo-text";
import { SetIsAskAiEnabled, SetIsDefaultSearchFilterOn } from "@/state/search";
import { Whitelabeled } from "@/state/whitelabeled";

export default async function Layout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ host: string; domain: string }>;
}) {
    const { host, domain } = await params;
    const isLocalEnvironment = isLocal();
    const loader = await createCachedDocsLoader(host, domain);
    const [
        { basePath },
        config,
        unsafe_fullRoot,
        edgeFlags,
        files,
        colors,
        layout,
        settings,
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

    return (
        <FernThemeProvider
            hasLight={Boolean(colors.light)}
            hasDark={Boolean(colors.dark)}
            lightThemeColor={colors.light?.themeColor}
            darkThemeColor={colors.dark?.themeColor}
        >
            <RootNodeProvider sidebarRootNodesToChildToParentsMap={sidebarRootNodesToChildToParentsMap}>
                <Domain value={domain} />
                <SetBasePath value={basePath || "/"} />
                {!isSelfHosted() && !settings.disableAnalytics && (
                    <>
                        <Analytics />
                        <SpeedInsights />
                    </>
                )}
                {/** HACKHACK: this is a hack to set the logo text to "Docs" for Cohere, this needs to be moved into docs.yml */}
                <SetLogoText text={domain.includes("cohere") ? "Docs" : undefined} />
                {config.defaultLanguage != null && <DefaultLanguage language={config.defaultLanguage} />}
                <DarkCode value={(edgeFlags.isDarkCodeEnabled || settings.darkModeCode) ?? false} />
                <Whitelabeled value={edgeFlags.isWhitelabeled} />
                <SetColors colors={colors} />
                <SetIsAskAiEnabled isAskAiEnabled={isAskAiEnabled} />
                <SetIsDefaultSearchFilterOn
                    isDefaultSearchFilterOn={
                        edgeFlags.isDefaultSearchFilterOn || (settings.defaultSearchFilters ?? false)
                    }
                />
                <FernUser domain={domain} host={host} />
                <GlobalStyles
                    domain={domain}
                    layout={layout}
                    fonts={fonts}
                    light={colors.light}
                    dark={colors.dark}
                    inlineCss={config.css?.inline}
                />
                <FeatureFlagProvider featureFlagsConfig={{ launchDarkly }}>{children}</FeatureFlagProvider>
                <React.Suspense fallback={null}>
                    {!isLocalEnvironment && !settings.disableSearch && (
                        <SearchV2 domain={domain} disableAnalytics={settings.disableAnalytics} lang={lang} />
                    )}
                </React.Suspense>
                {jsConfig != null && <JavascriptProvider config={jsConfig} />}
                {VERCEL_ENV === "production" && !settings.disableAnalytics && (
                    <CustomerAnalytics
                        config={mergeCustomerAnalytics(deprecated_customerAnalytics, config.analyticsConfig)}
                    />
                )}
            </RootNodeProvider>
        </FernThemeProvider>
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
    return await generateMetadataFromConfig({ params: props.params });
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
