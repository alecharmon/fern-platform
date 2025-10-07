"use client";

import type { MdxToHtmlResponse } from "@fern-docs/mdx";

import PageEditor from "./PageEditor";
import PageSubtitle from "./PageSubtitle";
import PageTitle from "./PageTitle";

export declare namespace PageContents {
    export interface Props {
        filename: string;
        initialHtml: MdxToHtmlResponse["html"];
        initialFrontmatter: MdxToHtmlResponse["frontmatter"];
    }
}

export default function PageContents({ filename, initialHtml, initialFrontmatter }: PageContents.Props) {
    const { title, subtitle } = initialFrontmatter ?? {};

    return (
        <div className="max-w-content-width-wide mx-auto w-full pb-64">
            <PageTitle className="w-full" filename={filename} initialText={title ? String(title) : undefined} />
            <PageSubtitle
                className="w-full"
                filename={filename}
                initialText={subtitle ? String(subtitle) : undefined}
            />
            <PageEditor className="-m-2 w-full p-3" filename={filename} initialHtml={initialHtml} />
        </div>
    );
}
