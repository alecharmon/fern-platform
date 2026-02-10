"use client";

import { useMemo } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import Card from "@/components/ui/card";
import type { ExportOptions } from "./types";

const A4_WIDTH_PX = 595;
const A4_HEIGHT_PX = 842;

// The desired height for the scaled PDF page in the preview.
const PREVIEW_PAGE_HEIGHT = 480;
// Equal padding around the page on all sides.
const PREVIEW_PADDING = 24;

export interface PdfCoverPreviewCardProps {
    docsUrl: string;
    orgName: Auth0OrgName;
    options: ExportOptions;
}

export function PdfCoverPreviewCard({ docsUrl, orgName, options }: PdfCoverPreviewCardProps) {
    const scale = PREVIEW_PAGE_HEIGHT / A4_HEIGHT_PX;

    const scaledSize = useMemo(() => {
        return {
            width: A4_WIDTH_PX * scale,
            height: A4_HEIGHT_PX * scale
        };
    }, [scale]);

    const containerSize = useMemo(() => {
        return {
            width: scaledSize.width + PREVIEW_PADDING * 2,
            height: scaledSize.height + PREVIEW_PADDING * 2
        };
    }, [scaledSize]);

    const coverTitleOverride = options.coverTitle;
    const coverSubtitleOverride = options.coverSubtitle;
    const hideFooter = options.hideCoverFooter === true;

    const iframeSrc = useMemo(() => {
        const params = new URLSearchParams();
        if (typeof coverTitleOverride === "string") {
            params.set("title", coverTitleOverride);
        }
        if (typeof coverSubtitleOverride === "string") {
            params.set("subtitle", coverSubtitleOverride);
        }
        if (hideFooter) {
            params.set("hideFooter", "1");
        }
        const q = params.toString();
        return `/${orgName}/pdf-cover-preview/${encodeURIComponent(docsUrl)}${q ? `?${q}` : ""}`;
    }, [coverSubtitleOverride, coverTitleOverride, docsUrl, hideFooter, orgName]);

    return (
        <Card className="flex-col gap-4">
            <div>
                <div className="text-base font-semibold text-gray-1100">Cover preview</div>
                <div className="mt-1 text-sm text-muted-foreground">
                    This preview updates as you customize cover settings.
                </div>
            </div>

            <div
                className="relative mx-auto flex items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40"
                style={{
                    width: containerSize.width,
                    height: containerSize.height,
                    padding: PREVIEW_PADDING
                }}
            >
                <div
                    className="relative bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
                    style={{
                        width: scaledSize.width,
                        height: scaledSize.height
                    }}
                >
                    <iframe
                        title="PDF cover preview"
                        src={iframeSrc}
                        className="absolute left-0 top-0 border-0 origin-top-left"
                        style={{
                            width: A4_WIDTH_PX,
                            height: A4_HEIGHT_PX,
                            transform: `scale(${scale})`
                        }}
                    />
                </div>
            </div>
        </Card>
    );
}
