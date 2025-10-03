import React from "react";

import { Prose } from "../mdx/prose";
import { HiddenSidebar, SetLayout } from "../state/layout";

interface PageLayoutProps {
    header?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
}

// sidebar is always hidden on page layouts
export function PageLayout({ header, children, footer }: PageLayoutProps) {
    return (
        <article className="fern-layout-page">
            <SetLayout value="page" />
            <HiddenSidebar />
            {header}
            <Prose className="prose-h1:mt-[1.5em] first:prose-h1:mt-0 max-w-full">{children}</Prose>
            {footer}
        </article>
    );
}
