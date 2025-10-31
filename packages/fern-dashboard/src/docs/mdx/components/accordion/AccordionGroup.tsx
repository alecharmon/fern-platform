import * as AccordionComponent from "@fern-docs/components/accordion";
import { Button } from "@fern-docs/components/button";
import { useCurrentAnchor } from "@fern-docs/components/hooks/use-anchor";
import { CirclePlusIcon } from "lucide-react";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useEditorComponentChildren } from "@/components/editor/editor-component";
import { TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";
import { cn } from "@/utils/utils";

export interface AccordionGroupProps {
    children: React.ReactNode;
    toc?: boolean;
}

export const EMPTY_ACCORDION_CONTENT = `
<Accordion title="Untitled">

</Accordion>
`;

export const EMPTY_ACCORDION_GROUP_CONTENT = `
<AccordionGroup>
  ${EMPTY_ACCORDION_CONTENT}
</AccordionGroup>
`;

interface AccordionData {
    id: string;
    title: string;
    toc?: boolean;
    nestedHeaders?: string[];
}

interface AccordionContextType {
    registerAccordion: (accordion: AccordionData) => void;
    unregisterAccordion: (id: string) => void;
    accordions: AccordionData[];
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

function useAccordionContext() {
    const context = useContext(AccordionContext);
    return context;
}

export function AccordionGroup({ children }: AccordionGroupProps) {
    const [accordions, setAccordions] = useState<AccordionData[]>([]);
    const [activeTabs, setActiveTabs] = useState<string[]>([]);
    const anchor = useCurrentAnchor();
    const [updatedUrl, setUpdatedUrl] = useState<string | null>(null);
    const [isProgrammaticUpdate, setIsProgrammaticUpdate] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const registerAccordion = useCallback((accordion: AccordionData) => {
        setAccordions((prevAccordions) => {
            // Check if accordion already exists
            const existingIndex = prevAccordions.findIndex((a) => a.id === accordion.id);
            if (existingIndex >= 0) {
                // Update existing accordion
                const newAccordions = [...prevAccordions];
                newAccordions[existingIndex] = accordion;
                return newAccordions;
            }
            // Add new accordion
            return [...prevAccordions, accordion];
        });
    }, []);

    const unregisterAccordion = useCallback((id: string) => {
        setAccordions((prevAccordions) => prevAccordions.filter((accordion) => accordion.id !== id));
    }, []);

    const findParentAccordion = useCallback(
        (anchor: string) => {
            if (accordions.some((accordion) => accordion.id === anchor)) {
                return anchor;
            }

            const parentAccordion = accordions.find((accordion) => accordion.nestedHeaders?.includes(anchor));

            if (parentAccordion) {
                return parentAccordion.id;
            }

            return undefined;
        },
        [accordions]
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

    const contextValue = useMemo(
        () => ({
            registerAccordion,
            unregisterAccordion,
            accordions
        }),
        [registerAccordion, unregisterAccordion, accordions]
    );

    const { isWithinEditor } = useEditorComponent();
    const { appendChildrenMdx } = useEditorComponentChildren();

    const accordionGroupContent = (
        <AccordionContext.Provider value={contextValue}>
            <div ref={popoverRef} className="relative">
                {isWithinEditor && (
                    <EditorComponentPopoverButton
                        className="absolute -right-8 top-2 z-10 h-auto w-auto px-2"
                        componentName="Accordion Group"
                    />
                )}
                <AccordionComponent.Accordion
                    type="multiple"
                    value={activeTabs}
                    onValueChange={handleValueChange}
                    className="m-mdx"
                >
                    {children}
                    {isWithinEditor && (
                        <div className="bg-(color:--grayscale-a1) flex justify-center border-dashed p-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    appendChildrenMdx(EMPTY_ACCORDION_CONTENT);
                                }}
                            >
                                <CirclePlusIcon />
                                Add accordion
                            </Button>
                        </div>
                    )}
                </AccordionComponent.Accordion>
            </div>
        </AccordionContext.Provider>
    );

    if (!isWithinEditor) {
        return accordionGroupContent;
    }

    return (
        <EditorComponentPopoverProvider attributes={{}} targetRef={popoverRef} hoverSlopThreshold={48}>
            {accordionGroupContent}
        </EditorComponentPopoverProvider>
    );
}

interface AccordionProps {
    /**
     * the title of the accordion
     * @default "Untitled"
     */
    title?: string;
    /**
     * the id of the accordion. this must be unique, and should have been set using the rehypeSlug plugin
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
}

function AccordionItem({
    title = "Untitled",
    id,
    toc,
    children,
    nestedHeaders,
    registerAccordion,
    unregisterAccordion,
    accordions,
    isInGroup = false
}: AccordionProps & AccordionContextType & { isInGroup?: boolean }) {
    const uniqueId = React.useId();
    const accordionId = id || `accordion-${uniqueId}`;

    useEffect(() => {
        registerAccordion({
            id: accordionId,
            title,
            toc,
            nestedHeaders
        });

        return () => {
            unregisterAccordion(accordionId);
        };
    }, [accordionId, title, toc, nestedHeaders, registerAccordion, unregisterAccordion]);

    const { isWithinEditor } = useEditorComponent();
    const popoverRef = useRef<HTMLButtonElement>(null);

    if (!children) {
        return null;
    }

    const accordionContent = (
        <AccordionComponent.AccordionItem
            id={accordionId}
            value={accordionId}
            nestedHeaders={nestedHeaders}
            className="relative !overflow-visible"
        >
            <AccordionComponent.AccordionTrigger ref={popoverRef}>
                {title}
                {isWithinEditor && (
                    <EditorComponentPopoverButton
                        className="absolute right-2 top-2 h-auto w-auto px-2"
                        componentName="Accordion"
                        disableDelete={isInGroup && accordions.length === 1}
                    />
                )}
            </AccordionComponent.AccordionTrigger>
            <AccordionComponent.AccordionContent className={isWithinEditor ? "!overflow-visible" : undefined}>
                <div className={cn("px-5", isWithinEditor && "pl-3")}>{children}</div>
            </AccordionComponent.AccordionContent>
        </AccordionComponent.AccordionItem>
    );

    if (!isWithinEditor) {
        return accordionContent;
    }

    return (
        <EditorComponentPopoverProvider
            attributes={{
                title: new TextInputControl({ defaultValue: title })
            }}
            targetRef={popoverRef}
        >
            {accordionContent}
        </EditorComponentPopoverProvider>
    );
}

export function Accordion(props: AccordionProps) {
    const accordionContext = useAccordionContext();

    if (accordionContext == null) {
        return (
            <AccordionComponent.Accordion type="multiple" className="m-mdx" defaultValue={[props.id || ""]}>
                <AccordionItem
                    {...props}
                    registerAccordion={() => {
                        console.error("[registerAccordion] AccordionItem is not within an AccordionContext");
                    }}
                    unregisterAccordion={() => {
                        console.error("[unregisterAccordion] AccordionItem is not within an AccordionContext");
                    }}
                    accordions={[{ id: props.id || "", title: props.title || "" }]}
                    isInGroup={false}
                />
            </AccordionComponent.Accordion>
        );
    }

    return <AccordionItem {...props} {...accordionContext} isInGroup={true} />;
}
