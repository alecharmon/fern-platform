import * as Collapsible from "@radix-ui/react-collapsible";
import React from "react";
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
    return (
        <Collapsible.Root open={open}>
            <Collapsible.Trigger asChild>{trigger}</Collapsible.Trigger>
            <Collapsible.Content asChild {...useFernCollapseOverflow()}>
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
