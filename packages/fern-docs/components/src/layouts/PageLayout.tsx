import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type React from "react";

import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";
import { HiddenSidebar } from "../theming/HiddenSidebar";

interface PageLayoutProps {
    header?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    theme?: FernThemeConfig;
}

// sidebar is always hidden on page layouts
export function PageLayout({ header, children, footer, theme }: PageLayoutProps) {
    const isCanvasTheme = theme?.body === "canvas";
    const content = (
        <div className="fern-layout-page">
            <SetLayout value="page" />
            <HiddenSidebar />
            <article>
                {header}
                <Prose className="prose-h1:mt-[1.5em] first:prose-h1:mt-0 max-w-full">{children}</Prose>
            </article>
            <div className="grow" />
            {footer}
        </div>
    );

    return isCanvasTheme ? <div className="canvas-wrapper">{content}</div> : content;
}
