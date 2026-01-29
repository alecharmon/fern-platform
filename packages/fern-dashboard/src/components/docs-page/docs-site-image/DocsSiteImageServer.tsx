import "server-only";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { AlertCircle } from "lucide-react";

import { getHomepageImageUrl } from "@/app/services/dal/homepage-images/getHomepageImageUrl";
import { convertFdrDocsSiteUrlToDocsUrl } from "@/utils/getDocsSiteUrl";

import { DocsSiteImageLayout } from "./DocsSiteImageLayout";
import { SkeletonDocsSiteImage } from "./SkeletonDocsSiteImage";

export declare namespace DocsSiteImageServer {
    export interface Props {
        docsSite: FdrAPI.dashboard.DocsSite;
    }
}

export async function DocsSiteImageServer({ docsSite }: DocsSiteImageServer.Props) {
    const docsUrls = docsSite.urls.map(convertFdrDocsSiteUrlToDocsUrl);

    let lightImageUrl: string | null = null;
    let darkImageUrl: string | null = null;
    let hasError = false;

    for (const url of docsUrls) {
        const [lightResult, darkResult] = await Promise.allSettled([
            getHomepageImageUrl({ url, theme: "light" }),
            getHomepageImageUrl({ url, theme: "dark" })
        ]);

        if (lightResult.status === "fulfilled" && lightResult.value?.imageUrl) {
            lightImageUrl = lightResult.value.imageUrl;
        } else if (lightResult.status === "rejected") {
            console.warn(`Failed to get light theme homepage image for ${url}`, lightResult.reason);
            hasError = true;
        }

        if (darkResult.status === "fulfilled" && darkResult.value?.imageUrl) {
            darkImageUrl = darkResult.value.imageUrl;
        } else if (darkResult.status === "rejected") {
            console.warn(`Failed to get dark theme homepage image for ${url}`, darkResult.reason);
            hasError = true;
        }

        if (lightImageUrl || darkImageUrl) {
            break;
        }
    }

    if (hasError && !lightImageUrl && !darkImageUrl) {
        return (
            <DocsSiteImageLayout docsUrl={docsSite.urls[0]}>
                <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-white text-gray-900 dark:bg-black">
                    <AlertCircle className="size-10" />
                    <div>Failed to load</div>
                </div>
            </DocsSiteImageLayout>
        );
    }

    if (!lightImageUrl && !darkImageUrl) {
        return <SkeletonDocsSiteImage docsUrl={docsSite.urls[0]} />;
    }

    return (
        <DocsSiteImageLayout docsUrl={docsSite.urls[0]}>
            <>
                {lightImageUrl && darkImageUrl ? (
                    <>
                        {/* biome-ignore lint/performance/noImgElement: false positive */}
                        <img
                            src={lightImageUrl}
                            alt="docs homepage"
                            className="flex-1 object-cover object-top block dark:hidden"
                        />
                        {/* biome-ignore lint/performance/noImgElement: false positive */}
                        <img
                            src={darkImageUrl}
                            alt="docs homepage"
                            className="flex-1 object-cover object-top hidden dark:block"
                        />
                    </>
                ) : (
                    <>
                        {/* biome-ignore lint/performance/noImgElement: false positive */}
                        <img
                            src={lightImageUrl || darkImageUrl || ""}
                            alt="docs homepage"
                            className="flex-1 object-cover object-top"
                        />
                    </>
                )}
            </>
        </DocsSiteImageLayout>
    );
}
