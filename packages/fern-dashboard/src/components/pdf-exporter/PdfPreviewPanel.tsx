"use client";

import { A4_PAGE_SIZE_PT } from "@fern-api/docs-pdf";
import { useMemo } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import Card from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfContentPagePreview } from "./PdfContentPagePreview";
import type { ExportOptions } from "./types";

export type PreviewTab = "cover" | "contentPage";
export type FocusedTemplateField = "headerLeft" | "headerRight" | "footerLeft" | "footerRight";

const PREVIEW_PAGE_HEIGHT = 480;
const PREVIEW_PADDING = 24;
const ZOOM_FACTOR = 4;

export interface PdfPreviewPanelProps {
    docsUrl: string;
    orgName: Auth0OrgName;
    options: ExportOptions;
    activeTab: PreviewTab;
    onTabChange: (tab: PreviewTab) => void;
    headerLeft: string | undefined;
    headerRight: string | undefined;
    footerLeft: string | undefined;
    footerRight: string | undefined;
    focusedTemplateField: FocusedTemplateField | null;
}

export function PdfPreviewPanel({
    docsUrl,
    orgName,
    options,
    activeTab,
    onTabChange,
    headerLeft,
    headerRight,
    footerLeft,
    footerRight,
    focusedTemplateField
}: PdfPreviewPanelProps) {
    const scale = PREVIEW_PAGE_HEIGHT / A4_PAGE_SIZE_PT.height;

    const scaledSize = useMemo(
        () => ({
            width: A4_PAGE_SIZE_PT.width * scale,
            height: A4_PAGE_SIZE_PT.height * scale
        }),
        [scale]
    );

    const contentTransform = useMemo(() => {
        if (focusedTemplateField == null) {
            return `translate(0px, 0px) scale(${scale})`;
        }
        const zs = scale * ZOOM_FACTOR;
        const tx =
            focusedTemplateField === "headerRight" || focusedTemplateField === "footerRight"
                ? scaledSize.width - A4_PAGE_SIZE_PT.width * zs
                : 0;
        const ty =
            focusedTemplateField === "footerLeft" || focusedTemplateField === "footerRight"
                ? scaledSize.height - A4_PAGE_SIZE_PT.height * zs
                : 0;
        return `translate(${tx}px, ${ty}px) scale(${zs})`;
    }, [focusedTemplateField, scale, scaledSize]);

    const containerSize = useMemo(
        () => ({
            width: scaledSize.width + PREVIEW_PADDING * 2,
            height: scaledSize.height + PREVIEW_PADDING * 2
        }),
        [scaledSize]
    );

    const iframeSrc = useMemo(() => {
        const params = new URLSearchParams();
        if (typeof options.coverTitle === "string") {
            params.set("title", options.coverTitle);
        }
        if (typeof options.coverSubtitle === "string") {
            params.set("subtitle", options.coverSubtitle);
        }
        if (options.hideCoverFooter) {
            params.set("hideFooter", "1");
        }
        const q = params.toString();
        return `/${orgName}/pdf-cover-preview/${encodeURIComponent(docsUrl)}${q ? `?${q}` : ""}`;
    }, [options.coverTitle, options.coverSubtitle, options.hideCoverFooter, docsUrl, orgName]);

    return (
        <Card className="flex-col gap-4">
            <div>
                <div className="text-base font-semibold text-gray-1100">Preview</div>
                <div className="mt-1 text-sm text-muted-foreground">Updates live as you customize settings.</div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as PreviewTab)}>
                <TabsList className="mt-0">
                    <TabsTrigger value="cover">Cover</TabsTrigger>
                    <TabsTrigger value="contentPage">Content Page</TabsTrigger>
                </TabsList>

                <TabsContent value="cover">
                    <PreviewPageFrame containerSize={containerSize} scaledSize={scaledSize}>
                        <iframe
                            title="PDF cover preview"
                            src={iframeSrc}
                            className="absolute left-0 top-0 origin-top-left border-0"
                            style={{
                                width: A4_PAGE_SIZE_PT.width,
                                height: A4_PAGE_SIZE_PT.height,
                                transform: `scale(${scale})`
                            }}
                        />
                    </PreviewPageFrame>
                </TabsContent>

                <TabsContent value="contentPage">
                    <PreviewPageFrame containerSize={containerSize} scaledSize={scaledSize}>
                        <div
                            className="absolute left-0 top-0 origin-top-left"
                            style={{
                                transform: contentTransform,
                                transition: "transform 400ms ease-in-out"
                            }}
                        >
                            <PdfContentPagePreview
                                headerLeft={headerLeft}
                                headerRight={headerRight}
                                footerLeft={footerLeft}
                                footerRight={footerRight}
                            />
                        </div>
                    </PreviewPageFrame>
                </TabsContent>
            </Tabs>
        </Card>
    );
}

function PreviewPageFrame({
    containerSize,
    scaledSize,
    children
}: {
    containerSize: { width: number; height: number };
    scaledSize: { width: number; height: number };
    children: React.ReactNode;
}) {
    return (
        <div
            className="relative mx-auto flex items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40"
            style={{
                width: containerSize.width,
                height: containerSize.height,
                padding: PREVIEW_PADDING
            }}
        >
            <div
                className="relative overflow-hidden bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
                style={{
                    width: scaledSize.width,
                    height: scaledSize.height
                }}
            >
                {children}
            </div>
        </div>
    );
}
