"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { Badge } from "@fern-docs/components/badges";
import { ChangelogContentLayout } from "@fern-docs/components/changelog/ChangelogContentLayout";
import { ChangelogEntryLabel } from "@fern-docs/components/changelog/ChangelogEntryLabel";

import { useEffect, useState } from "react";
import { cachedBundleMDX } from "@/components/editor/editor-mdx-renderer/cache";
import { ReadOnlyMdxContent } from "@/components/editor/ReadOnlyMdxContent";
import { useDevMode } from "@/providers/DevModeProvider";
import type { EncodedDocsUrl } from "@/utils/types";

export interface ChangelogEntryPageWrapperProps {
    node: FernNavigation.ChangelogEntryNode;
    markdown: string;
    docsUrl?: EncodedDocsUrl;
    branch?: string;
}

export function ChangelogEntryPageWrapper({ node, markdown, docsUrl, branch }: ChangelogEntryPageWrapperProps) {
    const { setCurrentPageType, setViewOnlyContentLoading } = useDevMode();
    const [allLoaded, setAllLoaded] = useState(false);

    useEffect(() => {
        setCurrentPageType("changelog");
        setViewOnlyContentLoading(true);

        return () => {
            setCurrentPageType(null);
            setViewOnlyContentLoading(false);
        };
    }, [setCurrentPageType, setViewOnlyContentLoading]);

    useEffect(() => {
        let cancelled = false;
        setAllLoaded(false);
        setViewOnlyContentLoading(true);

        cachedBundleMDX(markdown, { docsUrl, branch })
            .catch(() => {})
            .then(() => {
                if (!cancelled) {
                    setAllLoaded(true);
                    setViewOnlyContentLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [markdown, docsUrl, branch, setViewOnlyContentLoading]);

    if (!allLoaded) {
        return null;
    }

    return (
        <div className="fern-layout-changelog" data-aside-state="visible">
            <article className="fern-layout-page">
                <ChangelogContentLayout as="section">
                    <header className="mt-16 mb-8 space-y-2">
                        <h1 className="fern-page-heading">{node.title}</h1>
                    </header>
                </ChangelogContentLayout>
                <ChangelogContentLayout
                    as="article"
                    id={node.date}
                    stickyContent={
                        <ChangelogEntryLabel
                            title={node.title}
                            tags={
                                node.tags && node.tags.length > 0
                                    ? node.tags.map((tag) => (
                                          <Badge key={tag} size="sm" variant="outlined-subtle">
                                              {tag}
                                          </Badge>
                                      ))
                                    : undefined
                            }
                        />
                    }
                >
                    <div className="prose dark:prose-invert max-w-none">
                        <ReadOnlyMdxContent markdown={markdown} docsUrl={docsUrl} branch={branch} />
                    </div>
                </ChangelogContentLayout>
            </article>
        </div>
    );
}
