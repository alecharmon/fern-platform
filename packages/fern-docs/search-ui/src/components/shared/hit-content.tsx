import { formatUtc } from "@fern-api/ui-core-utils";
import { ApiMethodBadge, AvailabilityBadge } from "@fern-docs/components/badges";
import { cn } from "@fern-docs/components/cn";
import { uniq } from "es-toolkit/array";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactElement, type ReactNode } from "react";
import { Highlight, Snippet } from "react-instantsearch";
import { type MarkRequired, UnreachableCaseError } from "ts-essentials";

import type {
    AlgoliaRecordHit,
    ApiReferenceRecordHit,
    ChangelogRecordHit,
    MarkdownRecordHit,
    ParameterRecordHit
} from "../../types";

const headingLevels = ["h0", "h1", "h2", "h3", "h4", "h5", "h6"] as const;

function Breadcrumb({
    breadcrumb,
    endingArrow,
    productAndVersion
}: {
    breadcrumb: string[];
    endingArrow?: boolean;
    productAndVersion?: string[];
}): ReactNode {
    if (breadcrumb.length === 0) {
        return false;
    }

    return (
        <div className="fern-search-hit-breadcrumb">
            <span className="inline-flex items-center gap-0.5">
                {productAndVersion?.map((title) => (
                    <Fragment key={title}>
                        <span className="text-(color:--accent-12) font-medium">{title}</span>
                        <ChevronRight className="-mb-px size-3 shrink-0" />
                    </Fragment>
                ))}
                {uniq(breadcrumb).map((title, idx) => (
                    <Fragment key={title}>
                        <span>{title}</span>
                        {idx < breadcrumb.length - 1 && <ChevronRight className="-mb-px size-3 shrink-0" />}
                    </Fragment>
                ))}
                {endingArrow && <ChevronRight className="-mb-px size-3 shrink-0" />}
            </span>
        </div>
    );
}

type SegmentType = "markdown" | "changelog" | "parameter" | "http" | "webhook" | "websocket" | "grpc" | "graphql";
const SEGMENT_DISPLAY_NAMES: Record<SegmentType, string> = {
    markdown: "Guide",
    changelog: "Changelog",
    parameter: "Parameter",
    http: "Endpoint",
    webhook: "Webhook",
    websocket: "WebSocket",
    grpc: "gRPC",
    graphql: "GraphQL"
};

function HitContentWithTitle({ hit, children }: { hit: AlgoliaRecordHit; children: ReactNode }) {
    return (
        <div className="min-w-0 flex-1 shrink">
            <div className="flex items-baseline justify-between gap-1">
                <span
                    className={cn("fern-search-hit-title", {
                        deprecated:
                            hit.availability === "Deprecated" ||
                            hit.availability === "Sunset" ||
                            hit.availability === "Retired"
                    })}
                >
                    <Highlight
                        attribute="title"
                        hit={hit}
                        classNames={{
                            highlighted: "fern-search-hit-highlighted",
                            nonHighlighted: "fern-search-hit-non-highlighted"
                        }}
                    />
                    {hit.availability && (
                        <AvailabilityBadge availability={hit.availability} size="sm" rounded className="ml-1" />
                    )}
                </span>
                <span className="text-(color:--grayscale-a10) text-sm">
                    {SEGMENT_DISPLAY_NAMES[hit.type === "api-reference" ? hit.api_type : hit.type]}
                </span>
            </div>
            {children}
        </div>
    );
}

function MarkdownHitContent({
    hit,
    currentVersion,
    currentProduct
}: {
    hit: MarkdownRecordHit;
    currentVersion?: string;
    currentProduct?: string;
}): ReactElement<any> {
    const breadcrumb = createHierarchyBreadcrumb(hit.breadcrumb, hit.hierarchy, hit.level);
    const productAndVersion = getVersionProductPrefix(hit, currentVersion, currentProduct);

    return (
        <HitContentWithTitle hit={hit}>
            <Breadcrumb breadcrumb={breadcrumb} productAndVersion={productAndVersion} />
        </HitContentWithTitle>
    );
}

function ChangelogHitContent({
    hit,
    currentVersion,
    currentProduct
}: {
    hit: ChangelogRecordHit;
    currentVersion?: string;
    currentProduct?: string;
}): ReactElement<any> {
    const datestring = formatUtc(new Date(hit.date), "MMM d, yyyy");
    const breadcrumb = [...hit.breadcrumb.map((crumb) => crumb.title), datestring];
    const productAndVersion = getVersionProductPrefix(hit, currentVersion, currentProduct);
    return (
        <HitContentWithTitle hit={hit}>
            <Breadcrumb breadcrumb={breadcrumb} productAndVersion={productAndVersion} />
        </HitContentWithTitle>
    );
}

function ApiReferenceHitContent({
    hit,
    currentVersion,
    currentProduct
}: {
    hit: ApiReferenceRecordHit;
    currentVersion?: string;
    currentProduct?: string;
}): ReactElement<any> {
    const breadcrumb = hit.breadcrumb.map((crumb) => crumb.title);
    const productAndVersion = getVersionProductPrefix(hit, currentVersion, currentProduct);
    return (
        <HitContentWithTitle hit={hit}>
            <div className="inline-flex max-w-full items-baseline gap-1">
                <Breadcrumb breadcrumb={breadcrumb} productAndVersion={productAndVersion} endingArrow />
                <ApiMethodBadge method={hit.method} size="sm" className="shrink-0" variant="outlined" />
                <span className="fern-search-hit-endpoint-path shrink">{hit.endpoint_path}</span>
            </div>
        </HitContentWithTitle>
    );
}

function ParameterHitContent({
    hit,
    currentVersion,
    currentProduct
}: {
    hit: ParameterRecordHit;
    currentVersion?: string;
    currentProduct?: string;
}): ReactElement<any> {
    const breadcrumb = hit.breadcrumb.map((crumb) => crumb.title);
    const productAndVersion = getVersionProductPrefix(hit, currentVersion, currentProduct);
    const sectionLabel = hit.subsection_type ?? hit.section_type;

    return (
        <HitContentWithTitle hit={hit}>
            <div className="inline-flex max-w-full items-baseline gap-1">
                <Breadcrumb breadcrumb={breadcrumb} productAndVersion={productAndVersion} endingArrow />
                <ApiMethodBadge method={hit.method} size="sm" className="shrink-0" variant="outlined" />
                <span className="fern-search-hit-endpoint-path shrink">{hit.endpoint_path}</span>
                {sectionLabel && <span className="text-(color:--grayscale-a9) text-xs shrink-0">{sectionLabel}</span>}
                {hit.parameter_type && (
                    <span className="text-(color:--grayscale-a9) text-xs shrink-0">{hit.parameter_type}</span>
                )}
            </div>
        </HitContentWithTitle>
    );
}

function HitSnippet({ hit, attribute }: { hit: AlgoliaRecordHit; attribute?: keyof AlgoliaRecordHit }): ReactNode {
    if (!attribute) {
        return false;
    }

    return (
        <Snippet
            attribute={attribute}
            hit={hit}
            classNames={{
                root: "fern-search-hit-snippet",
                highlighted: "fern-search-hit-highlighted",
                nonHighlighted: "fern-search-hit-non-highlighted"
            }}
        />
    );
}

export function HitContent({
    hit,
    currentVersion,
    currentProduct
}: {
    hit: MarkRequired<AlgoliaRecordHit, "type">;
    currentVersion?: string;
    currentProduct?: string;
}): ReactNode {
    switch (hit.type) {
        case "markdown":
            return (
                <MarkdownHitContent
                    hit={hit as MarkdownRecordHit}
                    currentVersion={currentVersion}
                    currentProduct={currentProduct}
                />
            );
        case "changelog":
            return (
                <ChangelogHitContent
                    hit={hit as ChangelogRecordHit}
                    currentVersion={currentVersion}
                    currentProduct={currentProduct}
                />
            );
        case "api-reference":
            return (
                <ApiReferenceHitContent
                    hit={hit as ApiReferenceRecordHit}
                    currentVersion={currentVersion}
                    currentProduct={currentProduct}
                />
            );
        case "parameter":
            return (
                <ParameterHitContent
                    hit={hit as ParameterRecordHit}
                    currentVersion={currentVersion}
                    currentProduct={currentProduct}
                />
            );
        default:
            console.error(new UnreachableCaseError(hit));
            return false;
    }
}

function getVersionProductPrefix(hit: AlgoliaRecordHit, currentVersion?: string, currentProduct?: string): string[] {
    const prefix: string[] = [];

    // Add product title if it exists and differs from current product
    if (hit.product?.id && hit.product.id !== currentProduct && hit.product.title) {
        prefix.push(hit.product.title);
    }

    // Add version title if it exists and differs from current version
    if (hit.version?.id && hit.version.id !== currentVersion && hit.version.title) {
        prefix.push(hit.version.title);
    }

    return prefix;
}

function createHierarchyBreadcrumb(
    breadcrumb: { title: string; pathname?: string }[],
    hierarchy: Partial<Record<(typeof headingLevels)[number], { title?: string; id?: string }>> | undefined,
    level: (typeof headingLevels)[number] | undefined
) {
    const combinedBreadcrumb: string[] = [];

    combinedBreadcrumb.push(...breadcrumb.map((crumb) => crumb.title));

    if (level) {
        headingLevels.slice(0, headingLevels.indexOf(level)).forEach((headingLevel) => {
            const title = hierarchy?.[headingLevel]?.title;
            if (title) {
                combinedBreadcrumb.push(title);
            }
        });
    }

    return combinedBreadcrumb;
}

export { HitSnippet };
