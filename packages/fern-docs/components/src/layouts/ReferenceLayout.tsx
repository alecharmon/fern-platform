"use client";

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { useIsMobile } from "@fern-ui/react-commons";
import React, { type ComponentPropsWithoutRef } from "react";
import { cn } from "../cn";
import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";
import { CanvasWrapper } from "./CanvasWrapper";

interface ReferenceLayoutProps {
    header?: React.ReactNode;
    aside?: React.ReactNode;
    children?: React.ReactNode;
    reference?: React.ReactNode;
    /**
     * Custom footer content extracted from the description's <Footer> component.
     * Rendered below the response section but above the navigation footer.
     */
    descriptionFooter?: React.ReactNode;
    footer?: React.ReactNode;
    enableFullWidth?: boolean;
    /**
     * If true, scrolling will be disabled on the reference sidebar
     * so that the code examples are constrained and must implement
     * scrolling within themselves.
     */
    kind?: "api" | "guide";
    theme?: FernThemeConfig;
}

export const ReferenceLayout = React.forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<"article"> & ReferenceLayoutProps
>(function ReferenceLayout(
    { header, aside, children, footer, descriptionFooter, reference, enableFullWidth, kind = "api", theme, ...props },
    ref
) {
    const isMobile = useIsMobile();
    const isCanvasTheme = theme?.body === "canvas";
    const content = (
        <div className="fern-layout-reference">
            <SetLayout value="reference" />
            <article
                {...props}
                className={cn(
                    "w-content-width md:w-endpoint-width max-w-full",
                    { "xl:w-page-width": enableFullWidth },
                    props.className
                )}
                ref={ref}
            >
                {header}
                <div className="fern-layout-reference-content" data-kind={kind} data-cols={aside ? "2" : "1"}>
                    {!isMobile && (
                        <aside className="fern-layout-reference-aside">
                            {kind === "api" ? aside : <Prose className="relative">{aside}</Prose>}
                        </aside>
                    )}
                    <Prose className="mb-12 space-y-12">
                        <div className="mb-12 space-y-12">
                            {children && <React.Fragment key="children">{children}</React.Fragment>}
                            {isMobile && (
                                <section key="mobile-aside" className="fern-layout-reference-aside">
                                    {aside}
                                </section>
                            )}
                            {reference && <React.Fragment key="reference">{reference}</React.Fragment>}
                            {descriptionFooter && (
                                <React.Fragment key="description-footer">{descriptionFooter}</React.Fragment>
                            )}
                        </div>
                    </Prose>
                </div>
            </article>
            <div className="grow" />
            {footer}
        </div>
    );

    return isCanvasTheme ? <CanvasWrapper>{content}</CanvasWrapper> : content;
});
