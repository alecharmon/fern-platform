import * as Collapsible from "@radix-ui/react-collapsible";
import React, { useEffect, useRef } from "react";
import { cn } from "../cn";
import { useFernCollapseOverflow } from "../FernCollapse";

export function CollapsibleSidebarGroup({
    open,
    trigger,
    children,
    depth
}: {
    open: boolean;
    trigger: React.ReactNode;
    children: React.ReactNode;
    depth?: number;
}) {
    const isInitial = useRef(true);

    useEffect(() => {
        requestAnimationFrame(() => {
            isInitial.current = false;
        });
    }, []);

    return (
        <Collapsible.Root open={open}>
            <Collapsible.Trigger asChild>{trigger}</Collapsible.Trigger>
            <Collapsible.Content
                asChild
                {...useFernCollapseOverflow()}
                data-skip-animation={isInitial.current || undefined}
            >
                <ul
                    className={cn(
                        "fern-sidebar-group fern-collapsible border-border-concealed ml-4 border-l lg:ml-2 lg:py-1 lg:pl-1",
                        depth != null && `fern-sidebar-group-level-${depth + 1}`
                    )}
                >
                    {React.Children.map(children, (child, index) => (
                        <li key={React.isValidElement(child) ? (child.key ?? index) : index}>{child}</li>
                    ))}
                </ul>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
