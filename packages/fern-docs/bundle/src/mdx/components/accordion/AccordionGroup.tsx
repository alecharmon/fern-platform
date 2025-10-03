import React, { useEffect } from "react";

import { cn } from "@fern-docs/components";
import * as AccordionComponent from "@fern-docs/components";
import { useCurrentAnchor } from "@fern-docs/components/hooks/use-anchor";

import { unwrapChildren } from "../../common/unwrap-children";

export interface AccordionGroupProps {
    children: React.ReactNode;
    toc?: boolean;
    className?: string;
}

export function AccordionGroup({ children, className }: AccordionGroupProps) {
    const [activeTabs, setActiveTabs] = React.useState<string[]>([]);
    const anchor = useCurrentAnchor();
    const [updatedUrl, setUpdatedUrl] = React.useState<string | null>(null);
    const [isProgrammaticUpdate, setIsProgrammaticUpdate] = React.useState(false);
    const items = unwrapChildren(children, Accordion);

    const findParentAccordion = React.useCallback(
        (anchor: string) => {
            if (items.some((tab) => tab.props.id === anchor)) {
                return anchor;
            }

            const parentAccordion = items.find((tab) => tab.props.nestedHeaders?.includes(anchor));

            if (parentAccordion) {
                return parentAccordion.props.id;
            }

            return undefined;
        },
        [items]
    );

    React.useEffect(() => {
        if (anchor != null && !updatedUrl) {
            const parentAccordion = findParentAccordion(anchor);
            if (parentAccordion) {
                setIsProgrammaticUpdate(true);
                setActiveTabs((prev) => (prev.includes(parentAccordion) ? prev : [...prev, parentAccordion]));

                // wait for the accordion to open before scrolling
                setTimeout(() => {
                    const element = document.getElementById(anchor);
                    if (element) {
                        element.scrollIntoView({ behavior: "smooth" });
                    }
                    setIsProgrammaticUpdate(false);
                }, 100);
            }
        } // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anchor]);

    const handleValueChange = React.useCallback(
        (nextActiveTabs: string[]) => {
            if (isProgrammaticUpdate) {
                return;
            }

            setActiveTabs((prev) => {
                const added = nextActiveTabs.find((tab) => !prev.includes(tab));
                if (added != null) {
                    setUpdatedUrl(`${window.location.pathname}#${added}`);
                }

                const removed = prev.find((tab) => !nextActiveTabs.includes(tab));
                if (removed != null) {
                    setUpdatedUrl(window.location.pathname);
                }

                return nextActiveTabs;
            });
        },
        [isProgrammaticUpdate]
    );

    useEffect(() => {
        if (updatedUrl != null) {
            window.history.replaceState(null, "", updatedUrl);
        }
    }, [updatedUrl]);

    return (
        <AccordionComponent.Accordion
            type="multiple"
            value={activeTabs}
            onValueChange={handleValueChange}
            className={cn("m-mdx", className)}
        >
            {children}
        </AccordionComponent.Accordion>
    );
}

export function Accordion({
    title = "Untitled",
    id = "",
    children,
    nestedHeaders,
    className
}: {
    /**
     * the title of the accordion
     * @default "Untitled"
     */
    title?: string;
    /**
     * he id of the accordion. this must be unique, and should have been set using the rehypeSlug plugin
     * @default ""
     */
    id?: string;
    /**
     * whether to show the table of contents (this is used only in the rehype-toc plugin)
     */
    toc?: boolean;
    /**
     * the children of the accordion
     */
    children?: React.ReactNode;
    /**
     * the headers nested within the accordion
     */
    nestedHeaders?: string[];
    /**
     * the class name of the accordion
     */
    className?: string;
}) {
    if (!children) {
        return null;
    }
    return (
        <AccordionComponent.AccordionItem id={id} value={id} nestedHeaders={nestedHeaders} className={className}>
            <AccordionComponent.AccordionTrigger className={className}>{title}</AccordionComponent.AccordionTrigger>
            <AccordionComponent.AccordionContent className={className}>
                <div className="px-5">{children}</div>
            </AccordionComponent.AccordionContent>
        </AccordionComponent.AccordionItem>
    );
}
