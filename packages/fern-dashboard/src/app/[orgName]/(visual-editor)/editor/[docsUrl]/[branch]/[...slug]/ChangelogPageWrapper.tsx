"use client";

import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { Badge } from "@fern-docs/components/badges";
import { ChangelogContentLayout } from "@fern-docs/components/changelog/ChangelogContentLayout";
import { ChangelogEntryLabel } from "@fern-docs/components/changelog/ChangelogEntryLabel";
import { Fragment, useEffect, useMemo, useState } from "react";
import { cachedBundleMDX } from "@/components/editor/editor-mdx-renderer/cache";
import { ReadOnlyMdxContent } from "@/components/editor/ReadOnlyMdxContent";
import { useDevMode } from "@/providers/DevModeProvider";
import type { EncodedDocsUrl } from "@/utils/types";

export interface ChangelogEntry {
    node: FernNavigation.ChangelogEntryNode;
    markdown: string;
}

export interface ChangelogPageWrapperProps {
    title: string;
    overviewMarkdown: string | undefined;
    entries: ChangelogEntry[];
    docsUrl?: EncodedDocsUrl;
    branch?: string;
}

export function ChangelogPageWrapper({ title, overviewMarkdown, entries, docsUrl, branch }: ChangelogPageWrapperProps) {
    const { setCurrentPageType, setViewOnlyContentLoading } = useDevMode();
    const [allLoaded, setAllLoaded] = useState(false);

    const markdowns = useMemo(
        () => [...(overviewMarkdown ? [overviewMarkdown] : []), ...entries.map((e) => e.markdown)],
        [overviewMarkdown, entries]
    );

    useEffect(() => {
        setCurrentPageType("changelog");
        setViewOnlyContentLoading(true);

        return () => {
            setCurrentPageType(null);
            setViewOnlyContentLoading(false);
        };
    }, [setCurrentPageType, setViewOnlyContentLoading]);

    useEffect(() => {
        if (markdowns.length === 0) {
            setAllLoaded(true);
            setViewOnlyContentLoading(false);
            return;
        }

        let cancelled = false;
        setAllLoaded(false);
        setViewOnlyContentLoading(true);

        Promise.all(markdowns.map((md) => cachedBundleMDX(md, { docsUrl, branch }).catch(() => {}))).then(() => {
            if (!cancelled) {
                setAllLoaded(true);
                setViewOnlyContentLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [markdowns, docsUrl, branch, setViewOnlyContentLoading]);

    if (!allLoaded) {
        return null;
    }

    return (
        <div className="fern-layout-changelog" data-aside-state="visible">
            <article className="fern-layout-page max-w-full">
                <ChangelogContentLayout as="section">
                    <header className="mt-16 mb-8 space-y-2">
                        <h1 className="fern-page-heading">{title}</h1>
                    </header>
                    {overviewMarkdown && (
                        <ReadOnlyMdxContent markdown={overviewMarkdown} docsUrl={docsUrl} branch={branch} />
                    )}
                </ChangelogContentLayout>
                {entries.map((entry, i) => (
                    <Fragment key={entry.node.id}>
                        <ChangelogEntryCard
                            entry={entry}
                            docsUrl={docsUrl}
                            branch={branch}
                            className={i === 0 ? "mt-8" : "mt-16"}
                        />
                        {i < entries.length - 1 && <hr className="my-4" />}
                    </Fragment>
                ))}
            </article>
        </div>
    );
}

function ChangelogEntryCard({
    entry,
    docsUrl,
    branch,
    className
}: {
    entry: ChangelogEntry;
    docsUrl?: EncodedDocsUrl;
    branch?: string;
    className?: string;
}) {
    const tagBadges =
        entry.node.tags && entry.node.tags.length > 0
            ? entry.node.tags.map((tag) => (
                  <Badge key={tag} size="sm" variant="outlined-subtle">
                      {tag}
                  </Badge>
              ))
            : undefined;

    return (
        <ChangelogContentLayout
            className={className}
            as="article"
            id={entry.node.date}
            stickyContent={<ChangelogEntryLabel title={entry.node.title} tags={tagBadges} />}
        >
            <div className="prose dark:prose-invert max-w-none">
                <ReadOnlyMdxContent markdown={entry.markdown} docsUrl={docsUrl} branch={branch} />
            </div>
        </ChangelogContentLayout>
    );
}
