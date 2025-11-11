"use client";

import { Changelog } from "@fern-api/docs-utils";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { t } from "@fern-docs/i18n";
import { History } from "lucide-react";
import type { ReactNode } from "react";

import { WithFeatureFlags } from "../../feature-flags/WithFeatureFlags";
import { SidebarSlugLink } from "../SidebarLink";

export interface SidebarChangelogNodeProps {
    node: FernNavigation.ChangelogNode;
    icon: React.ReactNode;
    depth: number;
    className?: string;
    lang: string;
}

export function SidebarChangelogNode({ node, icon, depth, className, lang }: SidebarChangelogNodeProps): ReactNode {
    let changelogTitle = node.title;
    if (changelogTitle === "Changelog") {
        changelogTitle = t(lang).navigation.changelog;
    }

    return (
        <WithFeatureFlags featureFlags={node.featureFlags}>
            <SidebarSlugLink
                nodeId={node.id}
                slug={node.slug}
                title={changelogTitle}
                className={className}
                depth={Math.max(0, depth - 1)}
                icon={icon || <History />}
                tooltipContent={renderChangelogTooltip(node, lang)}
                hidden={node.hidden}
                authed={node.authed}
            />
        </WithFeatureFlags>
    );
}

// NOTE: this needs to be run client-side because of the date formatting
function renderChangelogTooltip(changelog: FernNavigation.ChangelogNode, lang: string): string | undefined {
    const latestChange: FernNavigation.ChangelogEntryNode | undefined = changelog.children[0]?.children[0]?.children[0];

    if (latestChange == null) {
        return undefined;
    }

    return `${t(lang).navigation.lastUpdated} ${Changelog.toCalendarDate(latestChange.date)}`;
}
