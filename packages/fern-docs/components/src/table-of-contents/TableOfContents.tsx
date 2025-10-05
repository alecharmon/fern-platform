"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import React from "react";

import fastdom from "fastdom";
import { useCallbackOne } from "use-memo-one";

import type { FernUser } from "@fern-api/docs-auth";
import type { TableOfContentsItem as TableOfContentsItemType } from "@fern-docs/mdx";

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

export const TableOfContents: React.FC<TableOfContents.Props> = ({ className, tableOfContents, style }) => {
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

    const [anchorInView, setAnchorInView] = useState<string | undefined>(undefined);

    const currentPathAnchor = useCurrentAnchor();

    React.useEffect(() => {
        if (currentPathAnchor != null && allAnchors.includes(currentPathAnchor)) {
            anchorJustSet = true;
            setAnchorInView(currentPathAnchor);
            clearTimeout(anchorJustSetTimeout);
            anchorJustSetTimeout = window.setTimeout(() => {
                anchorJustSet = false;
            }, 500);
        }
    }, [allAnchors, currentPathAnchor]);

    const measure = useTableOfContentsObserver(
        allAnchors,
        useCallback(
            (id: string | undefined) => {
                if (!anchorJustSet) {
                    setAnchorInView(id);
                }
            },
            [setAnchorInView]
        )
    );

    useEffect(() => {
        measure();
    }, [measure]);

    const [liHeight, setLiHeight] = useState<number>(0);
    const [offsetTop, setOffsetTop] = useState<number>(0);

    /**
     * when the anchorInView changes to null, reset the height and top of the active li
     */
    useEffect(() => {
        if (anchorInView == null) {
            setLiHeight(0);
            setOffsetTop(0);
        }
    }, [anchorInView]);

    const setActiveRef = useCallbackOne((liRef: HTMLLIElement) => {
        fastdom.measure(() => {
            setLiHeight(liRef.getBoundingClientRect().height);
            setOffsetTop(liRef.offsetTop);
        });
    }, []);

    const flattenTableOfContents = (items: TableOfContentsItemType[], depth = 0): ReactNode => {
        return items.flatMap(({ simpleString: text, anchorString, children, featureFlags }) => {
            if (text.length === 0) {
                // don't render empty headings
                return [];
            }
            return [
                <WithFeatureFlags featureFlags={featureFlags} key={`${depth}-${anchorString}`}>
                    <TableOfContentsItem
                        key={`${depth}-${anchorString}`}
                        text={text}
                        anchorString={anchorString}
                        active={anchorInView === anchorString}
                        setActiveRef={setActiveRef}
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
                <div className="text-(color:--grayscale-a11) m-0 mb-3 text-sm font-medium">On this page</div>
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
