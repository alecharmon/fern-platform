"use client";

import { slugToHref } from "@fern-api/docs-utils";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import { useIsDesktop } from "@fern-ui/react-commons";
import { ChevronDown, ChevronsUpDown, Lock, Tag } from "lucide-react";
import { type Availability, AvailabilityBadge, AvailabilityFullyQualifiedDisplayNames } from "../badges";
import { cn } from "../cn";
import { FernLinkDropdown } from "../FernLinkDropdown";
import { FernSelectionItem } from "../FernSelectionItem";
import { useCurrentVersionId, useCurrentVersionSlug } from "../state/navigation";

export interface VersionDropdownItem {
    versionId: string;
    title: string;
    slug: string;
    defaultSlug?: string;
    icon?: React.ReactNode;
    authed?: boolean;
    default: boolean;
    availability?: Availability;
    hidden?: boolean;
}

export function VersionDropdownClient({
    versions,
    fallbackVersion,
    useDenseLayout = false,
    forceHeader = false
}: {
    versions: VersionDropdownItem[];
    fallbackVersion: FernNavigation.VersionNode;
    useDenseLayout?: boolean;
    forceHeader?: boolean;
}) {
    const isDesktop = useIsDesktop();
    const currentVersionId = useCurrentVersionId();
    const currentVersionSlug = useCurrentVersionSlug();
    const currentVersion =
        versions.find((version) => version.versionId === currentVersionId) ??
        fallbackVersion ??
        versions.find((version) => version.default);

    return (
        <FernLinkDropdown
            value={currentVersionId}
            options={versions.map(({ icon, versionId, title, availability, slug, defaultSlug, authed, hidden }) => ({
                type: "value",
                label: (
                    <div className="flex items-center gap-2">
                        {title}
                        {availability != null ? <AvailabilityBadge availability={availability} size="sm" /> : null}
                    </div>
                ),
                value: versionId,
                disabled: availability == null,
                href: slugToHref(
                    pickVersionSlug({
                        currentVersionSlug,
                        defaultSlug,
                        slug
                    })
                ),
                icon: authed ? <Lock className="text-(color:--grayscale-a9) size-4 self-center" /> : icon,
                className: hidden ? "opacity-50" : undefined
            }))}
            contentProps={{
                "data-testid": "version-dropdown-content"
            }}
            side="bottom"
            align={isDesktop ? "start" : "center"}
            triggerAsChild={false}
            className="fern-version-selector w-full lg:w-auto"
            radioGroupProps={{
                className: "fern-version-selector-radio-group"
            }}
        >
            <>
                <div
                    className={cn("version-dropdown-trigger h-9", {
                        hidden: !forceHeader,
                        "lg:flex": !useDenseLayout
                    })}
                    data-testid="version-dropdown"
                >
                    {currentVersion.title}
                    <ChevronDown className="size-icon transition-transform data-[state=open]:rotate-180" />
                </div>
                <FernSelectionItem
                    icon={<Tag />}
                    title={currentVersion.title}
                    subtitle={
                        currentVersion.availability
                            ? AvailabilityFullyQualifiedDisplayNames[currentVersion.availability]
                            : undefined
                    }
                    dense
                    endIcon={<ChevronsUpDown className="size-icon" />}
                    className={cn("version-dropdown-trigger w-full", {
                        "lg:hidden!": !useDenseLayout && !forceHeader,
                        hidden: forceHeader
                    })}
                    testId="version-dropdown"
                />
            </>
        </FernLinkDropdown>
    );
}

function pickVersionSlug({
    currentVersionSlug,
    defaultSlug,
    slug
}: {
    currentVersionSlug?: string;
    defaultSlug?: string;
    slug: string;
}): string {
    if (!defaultSlug) {
        return slug;
    }

    if (currentVersionSlug != null && slug.startsWith(currentVersionSlug)) {
        return slug;
    }

    return defaultSlug;
}
