"use client";

import type { FernUser } from "@fern-api/docs-auth";
import { t } from "@fern-docs/i18n";
import type { TableOfContentsItem as TableOfContentsItemType } from "@fern-docs/mdx";
import fastdom from "fastdom";
import React, { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCallbackOne } from "use-memo-one";
import { cn } from "../cn";
import { WithFeatureFlags } from "../feature-flags/WithFeatureFlags";
import { useCurrentAnchor } from "../hooks/use-anchor";
import { useFernUser } from "../state/fern-user";
import { TableOfContentsItem } from "./TableOfContentsItem";
import { useTableOfContentsObserver } from "./useTableOfContentsObserver";

export declare namespace TableOfContents {
    export interface Props {
        className?: string;
        style?: CSSProperties;
        tableOfContents: TableOfContentsItemType[];
        lang: string;
    }
}

let anchorJustSet = false;
let anchorJustSetTimeout: number;

export function hasRequiredRole(
    user: FernUser | undefined,
    roleRequirements?:
        | {
              roles?: string[];
              not?: boolean;
              loggedIn?: boolean;
          }[]
        | undefined
): boolean {
    if (roleRequirements == null) {
        return true;
    }

    const userRoles = user?.roles ?? [];

    return roleRequirements.every((requirement) => {
        if (requirement.not && requirement.roles?.length === 0 && userRoles.length > 0) {
            return true;
        }

        const { roles, loggedIn } = requirement;

        const shouldShow = () => {
            if (roles != null) {
                if (roles.length === 0) {
                    return user != null;
                }
                return roles.some((role) => userRoles.includes(role) || role === "everyone");
            }
            if (loggedIn != null) {
                return loggedIn === (user != null);
            }
            return true;
        };

        return requirement.not ? !shouldShow() : shouldShow();
    });
}

function filterTocByRoles(items: TableOfContentsItemType[], user: FernUser | undefined): TableOfContentsItemType[] {
    return items
        .map((item) => {
            if (!hasRequiredRole(user, item.roleRequirements)) {
                return null;
            }

            const filteredChildren = filterTocByRoles(item.children, user);

            return {
                ...item,
                children: filteredChildren
            };
        })
        .filter((item): item is TableOfContentsItemType => item != null);
}

export const TableOfContents: React.FC<TableOfContents.Props> = ({ className, tableOfContents, style, lang }) => {
    const user = useFernUser();

    // filter toc items based on user roles
    const filteredTableOfContents = useMemo(() => {
        return filterTocByRoles(tableOfContents, user);
    }, [tableOfContents, user]);

    const allAnchors = useMemo(() => {
        const flatten = (items: TableOfContentsItemType[]): string[] =>
            items.flatMap((item) => [item.anchorString, ...flatten(item.children)]);
        return flatten(filteredTableOfContents);
    }, [filteredTableOfContents]);

    const [anchorsInView, setAnchorsInView] = useState<string[]>([]);
    const tocItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

    const currentPathAnchor = useCurrentAnchor();

    React.useEffect(() => {
        if (currentPathAnchor != null && allAnchors.includes(currentPathAnchor)) {
            anchorJustSet = true;
            setAnchorsInView([currentPathAnchor]);
            clearTimeout(anchorJustSetTimeout);
            anchorJustSetTimeout = window.setTimeout(() => {
                anchorJustSet = false;
            }, 500);
        }
    }, [allAnchors, currentPathAnchor]);

    const measure = useTableOfContentsObserver(
        allAnchors,
        useCallback((ids: string[]) => {
            if (!anchorJustSet) {
                setAnchorsInView(ids);
            }
        }, [])
    );

    useEffect(() => {
        measure();
    }, [measure]);

    const [liHeight, setLiHeight] = useState<number>(0);
    const [offsetTop, setOffsetTop] = useState<number>(0);

    const registerListItemRef = useCallbackOne((anchorString: string, node: HTMLLIElement | null) => {
        if (node) {
            tocItemRefs.current.set(anchorString, node);
        } else {
            tocItemRefs.current.delete(anchorString);
        }
    }, []);

    /**
     * adjust highlight pill to wrap all visible anchors
     */
    useEffect(() => {
        if (anchorsInView.length === 0) {
            setLiHeight(0);
            setOffsetTop(0);
            return;
        }

        const firstAnchorId = anchorsInView[0];
        const lastAnchorId = anchorsInView[anchorsInView.length - 1];
        if (!firstAnchorId || !lastAnchorId) {
            return;
        }

        const firstAnchor = tocItemRefs.current.get(firstAnchorId);
        const lastAnchor = tocItemRefs.current.get(lastAnchorId);

        if (!firstAnchor || !lastAnchor) {
            return;
        }

        fastdom.measure(() => {
            const top = firstAnchor.offsetTop;
            const lastBottom = lastAnchor.offsetTop + lastAnchor.getBoundingClientRect().height;
            setOffsetTop(top);
            setLiHeight(Math.max(lastBottom - top, 0));
        });
    }, [anchorsInView]);

    const flattenTableOfContents = (items: TableOfContentsItemType[], depth = 0): ReactNode => {
        return items.flatMap(({ simpleString: text, anchorString, children, featureFlags }) => {
            if (text.length === 0) {
                // don't render empty headings
                return [];
            }
            const isActive = anchorsInView.includes(anchorString);
            return [
                <WithFeatureFlags featureFlags={featureFlags} key={`${depth}-${anchorString}`}>
                    <TableOfContentsItem
                        key={`${depth}-${anchorString}`}
                        text={text}
                        anchorString={anchorString}
                        active={isActive}
                        registerRef={registerListItemRef}
                        depth={depth}
                    />
                </WithFeatureFlags>,
                flattenTableOfContents(children, depth + 1)
            ];
        });
    };

    return (
        <>
            {filteredTableOfContents.length > 0 && (
                <div className="text-(color:--grayscale-a11) m-0 mb-3 text-sm font-medium">
                    {t(lang).navigation.onThisPage}
                </div>
            )}
            {filteredTableOfContents.length > 0 && (
                <ul
                    className={cn("toc-root not-prose", className)}
                    style={
                        {
                            ...style,
                            "--height": `${liHeight}px`,
                            "--top": `${offsetTop}px`
                        } as CSSProperties
                    }
                >
                    {flattenTableOfContents(filteredTableOfContents)}
                </ul>
            )}
        </>
    );
};
