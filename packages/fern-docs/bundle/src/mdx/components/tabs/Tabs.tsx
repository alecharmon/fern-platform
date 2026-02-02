import { ApiDefinition } from "@fern-api/fdr-sdk";
import { cn } from "@fern-docs/components/cn";
import { useCurrentAnchor } from "@fern-docs/components/hooks/use-anchor";
import { useProgrammingLanguage } from "@fern-docs/components/state/language";
import * as RadixTabs from "@radix-ui/react-tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { unwrapChildren } from "../../common/unwrap-children";

export interface TabProps {
    title?: string;
    id: string;
    toc?: boolean;
    children: ReactNode;
    language?: string;
    className?: string;
    nestedHeaders?: string[];
}

export interface TabGroupProps {
    toc?: boolean;
    className?: string;
    /**
     * the query parameter name to use for tab selection (e.g., "tab")
     * when set, the selected tab will be synced with the URL query parameter
     */
    paramName?: string;
}

export function TabGroup({
    children,
    className,
    paramName
}: {
    toc?: boolean;
    children?: ReactNode;
    className?: string;
    /**
     * the query parameter name to use for tab selection (e.g., "tab")
     * when set, the selected tab will be synced with the URL query parameter
     */
    paramName?: string;
}) {
    const items = unwrapChildren(children, Tab);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const tabParam = paramName ? searchParams.get(paramName) : null;

    const [activeTab, setActiveTab] = useState(() => {
        // Priority: query param > first tab
        if (tabParam != null) {
            const matchingTab = items.find((item) => item.props.id === tabParam);
            if (matchingTab) {
                return tabParam;
            }
        }
        return items[0]?.props.id;
    });
    const anchor = useCurrentAnchor();
    const [selectedLanguage, setSelectedLanguage] = useProgrammingLanguage();
    const lastProcessedAnchorRef = useRef<string | null>(null);

    const findParentTab = useCallback(
        (anchor: string) => {
            // First check if the anchor matches any tab's ID directly
            if (items.some((tab) => tab.props.id === anchor)) {
                return anchor;
            }

            // Then check if the anchor matches any nested header within a tab
            const parentTab = items.find((tab) => tab.props.nestedHeaders?.includes(anchor));

            if (parentTab) {
                return parentTab.props.id;
            }

            return undefined;
        },
        [items]
    );

    // Sync with query parameter when it changes
    useEffect(() => {
        if (tabParam != null) {
            const matchingTab = items.find((item) => item.props.id === tabParam);
            if (matchingTab) {
                setActiveTab(tabParam);
            }
        }
    }, [tabParam, items]);

    useEffect(() => {
        // Only process if anchor actually changed to avoid re-processing when findParentTab changes
        if (anchor === lastProcessedAnchorRef.current) {
            return;
        }

        if (anchor != null && anchor !== "") {
            const parentTab = findParentTab(anchor);
            if (parentTab) {
                lastProcessedAnchorRef.current = anchor;
                setActiveTab(parentTab);

                // If this is a nested header (not the tab itself), scroll to it after the tab opens
                if (parentTab !== anchor) {
                    setTimeout(() => {
                        const element = document.getElementById(anchor);
                        if (element) {
                            element.scrollIntoView({ behavior: "smooth" });
                        }
                    }, 100);
                }
            }
        } else {
            lastProcessedAnchorRef.current = anchor;
        }
    }, [anchor, findParentTab]);

    useEffect(() => {
        if (selectedLanguage) {
            const matchingTab = items.find(
                (item) => item.props.language && ApiDefinition.cleanLanguage(item.props.language) === selectedLanguage
            );
            if (matchingTab) {
                setActiveTab((prevActiveTab) => {
                    const prevTab = items.find((item) => item.props.id === prevActiveTab);
                    if (
                        prevTab?.props.language &&
                        ApiDefinition.cleanLanguage(prevTab.props.language) === selectedLanguage
                    ) {
                        return prevActiveTab;
                    }
                    return matchingTab.props.id;
                });
            }
        }
    }, [selectedLanguage, items]);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);

        // Update URL with query parameter when paramName is specified
        if (paramName) {
            const params = new URLSearchParams(searchParams.toString());
            params.set(paramName, tabId);
            const newURL = `${pathname}?${params.toString()}`;
            router.replace(newURL, { scroll: false });
        }

        const selectedTab = items.find((item) => item.props.id === tabId);
        const cleanedLanguage = selectedTab?.props.language
            ? ApiDefinition.cleanLanguage(selectedTab.props.language)
            : undefined;
        if (cleanedLanguage && cleanedLanguage !== selectedLanguage) {
            setSelectedLanguage(cleanedLanguage);
        }
    };

    return (
        <RadixTabs.Root value={activeTab} onValueChange={handleTabChange}>
            <RadixTabs.List
                className={cn(
                    "border-border-default mb-6 mt-4 flex gap-4 overflow-x-auto overflow-y-hidden border-b first:-mt-3",
                    className
                )}
            >
                {items.map(({ props: { title = "Untitled", id = "" } }) => (
                    <RadixTabs.Trigger key={id} value={id} asChild>
                        <h6
                            className={cn(
                                "text-(color:--grayscale-a11) hover:border-border-default -mb-px flex max-w-max cursor-pointer whitespace-nowrap border-b border-transparent pb-2.5 pt-3 text-sm font-semibold leading-6",
                                "data-[state=active]:text-(color:--accent-a11) data-[state=active]:before:bg-(color:--accent-track) relative data-[state=active]:before:absolute data-[state=active]:before:inset-x-0 data-[state=active]:before:-bottom-px data-[state=active]:before:h-[2px]"
                            )}
                            id={id}
                        >
                            {title}
                        </h6>
                    </RadixTabs.Trigger>
                ))}
            </RadixTabs.List>
            {children}
        </RadixTabs.Root>
    );
}

export function Tab({
    id = "",
    children,
    className
}: {
    /**
     * the title of the tab
     * @default "Untitled"
     */
    title?: string;
    /**
     * the id of the tab (this must be unique, and should have been set using the rehypeSlug plugin)
     * @default ""
     */
    id?: string;
    /**
     * whether to show the table of contents (this is used only in the rehype-toc plugin)
     */
    toc?: boolean;
    /**
     * the language of the tab (sets the global language state)
     */
    language?: string;
    /**
     * the children of the tab
     */
    children?: ReactNode;
    className?: string;
    /**
     * the headers nested within the tab
     */
    nestedHeaders?: string[];
}) {
    return (
        <RadixTabs.Content
            key={id}
            value={id}
            className={cn("border:content-[''] before:mb-4 before:block", className)}
        >
            {children}
        </RadixTabs.Content>
    );
}
