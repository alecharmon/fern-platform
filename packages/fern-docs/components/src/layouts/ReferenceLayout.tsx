"use client";

import { useIsMobile } from "@fern-ui/react-commons";
import React, { type ComponentPropsWithoutRef } from "react";

import { cn } from "../cn";
import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";

interface ReferenceLayoutProps {
    header?: React.ReactNode;
    aside?: React.ReactNode;
    children?: React.ReactNode;
    reference?: React.ReactNode;
    footer?: React.ReactNode;
    enableFullWidth?: boolean;
    /**
     * If true, scrolling will be disabled on the reference sidebar
     * so that the code examples are constrained and must implement
     * scrolling within themselves.
     */
    kind?: "api" | "guide";
}

export const ReferenceLayout = React.forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<"article"> & ReferenceLayoutProps
>(function ReferenceLayout(
    { header, aside, children, footer, reference, enableFullWidth, kind = "api", ...props },
    ref
) {
    const isMobile = useIsMobile();
    return (
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
                            {children && <div key="children">{children}</div>}
                            {isMobile && (
                                <section key="mobile-aside" className="fern-layout-reference-aside">
                                    {aside}
                                </section>
                            )}
                            {reference && <div key="reference">{reference}</div>}
                            {footer && <div key="footer">{footer}</div>}
                        </div>
                    </Prose>
                </div>
            </article>
        </div>
    );
});
