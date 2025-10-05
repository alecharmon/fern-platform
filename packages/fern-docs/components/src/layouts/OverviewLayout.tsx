import type React from "react";

import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";

interface OverviewLayoutProps {
    header?: React.ReactNode;
    toc?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
}

export function OverviewLayout({ header, toc, children, footer }: OverviewLayoutProps) {
    return (
        <>
            <SetLayout value="overview" />
            {toc}
            <div className="fern-layout-overview">
                <article className="w-content-wide-width max-w-full">
                    {header}
                    <Prose className="prose-h1:mt-[1.5em] first:prose-h1:mt-0 max-w-full">{children}</Prose>
                    {footer}
                </article>
            </div>
        </>
    );
}
