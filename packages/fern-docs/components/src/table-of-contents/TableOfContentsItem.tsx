"use client";

import { memo, type ReactElement, useEffect, useRef } from "react";
import { cn } from "../cn";
import { HashLink } from "./HashLink";

export interface TableOfContentsItemProps {
    text: string;
    anchorString: string;
    active: boolean;
    registerRef: (anchor: string, ref: HTMLLIElement | null) => void;
    depth?: number;
}

export const TableOfContentsItem = memo<TableOfContentsItemProps>((props): ReactElement<any> => {
    const { text, anchorString, active, registerRef, depth = 0 } = props;
    const ref = useRef<HTMLLIElement>(null);
    useEffect(() => {
        registerRef(anchorString, ref.current);
        return () => {
            registerRef(anchorString, null);
        };
    }, [anchorString, registerRef]);

    return (
        <li className="mb-2 last:mb-0" ref={ref} data-depth={depth}>
            <HashLink
                className={cn("block break-words text-sm transition-colors hover:transition-none", {
                    "text-(color:--grayscale-a11) hover:text-(color:--grayscale-a12)": !active,
                    "text-(color:--accent-a11) font-semibold tracking-tight": active
                })}
                href={`#${anchorString}`}
                style={{
                    paddingLeft: `${depth * 12}px`
                }}
            >
                {text}
            </HashLink>
        </li>
    );
});

TableOfContentsItem.displayName = "TableOfContentsItem";
