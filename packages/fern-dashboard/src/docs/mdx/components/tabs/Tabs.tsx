import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { Button } from "@fern-docs/components/button";
import { cn } from "@fern-docs/components/cn";
import { useCurrentAnchor } from "@fern-docs/components/hooks/use-anchor";
import * as RadixTabs from "@radix-ui/react-tabs";
import { CirclePlusIcon } from "lucide-react";
import React, {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { useEditorComponentChildren } from "@/components/editor/editor-component";
import { TextInputControl } from "@/components/editor/editor-component/controls";
import {
    type EditorComponentContextValue,
    EditorComponentProvider,
    useEditorComponent
} from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";
import { useProgrammingLanguage } from "@/docs/state/language";

export const EMPTY_TAB_CONTENT = `
<Tab title="Untitled">

</Tab>
`;

export const EMPTY_TABS_CONTENT = `
<Tabs>
  ${EMPTY_TAB_CONTENT}
</Tabs>
`;

export interface TabProps {
    title?: string;
    id: string;
    toc?: boolean;
    children: ReactNode;
    language?: string;
}

export interface TabGroupProps {
    toc?: boolean;
}

interface TabData {
    id: string;
    title: string;
    language?: string;
    toc?: boolean;
    // EditorComponent values passed from Tab to TabGroup
    editorComponentValues?: EditorComponentContextValue;
}

interface TabsContextType {
    registerTab: (tab: TabData) => void;
    unregisterTab: (id: string) => void;
    tabs: TabData[];
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabsContext() {
    const context = useContext(TabsContext);
    if (!context) {
        throw new Error("Tab must be used within a TabGroup");
    }
    return context;
}

// TabHeader component that includes the popover button
function TabHeader({ id, title, tabs }: { id: string; title: string; tabs: TabData[] }) {
    const popoverRef = useRef<HTMLHeadingElement>(null);

    return (
        <EditorComponentPopoverProvider
            attributes={{
                title: new TextInputControl({ defaultValue: title })
            }}
            targetRef={popoverRef}
            hoverSlopThreshold={15}
        >
            <div className="group relative">
                <RadixTabs.Trigger value={id} asChild>
                    <h6
                        ref={popoverRef}
                        className={cn(
                            "text-(color:--grayscale-a11) hover:border-border-default -mb-px flex max-w-max cursor-pointer whitespace-nowrap border-b border-transparent pb-2.5 pt-3 text-sm font-semibold leading-6",
                            "data-[state=active]:text-(color:--accent-a11) data-[state=active]:before:bg-(color:--accent-track) relative data-[state=active]:before:absolute data-[state=active]:before:inset-x-0 data-[state=active]:before:-bottom-px data-[state=active]:before:h-[2px]",
                            "group relative mr-4 select-none"
                        )}
                        id={id}
                    >
                        {title}
                    </h6>
                </RadixTabs.Trigger>
                <EditorComponentPopoverButton
                    className="absolute -right-2.5 top-1/2 -translate-y-1/2 px-1 group-hover:bg-gray-400/50"
                    disableDelete={tabs.length === 1}
                />
            </div>
        </EditorComponentPopoverProvider>
    );
}

export function TabGroup({ children }: { toc?: boolean; children?: ReactNode }) {
    const [tabs, setTabs] = useState<TabData[]>([]);
    const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
    const anchor = useCurrentAnchor();
    const [selectedLanguage, setSelectedLanguage] = useProgrammingLanguage();
    const { isWithinEditor } = useEditorComponent();
    const { appendChildrenMdx } = useEditorComponentChildren();

    const registerTab = useCallback((tab: TabData) => {
        setTabs((prevTabs) => {
            // Check if tab already exists
            const existingIndex = prevTabs.findIndex((t) => t.id === tab.id);
            if (existingIndex >= 0) {
                // Update existing tab but preserve its position to maintain order
                const newTabs = [...prevTabs];
                newTabs[existingIndex] = { ...newTabs[existingIndex], ...tab };
                return newTabs;
            }
            // Add new tab
            return [...prevTabs, tab];
        });
    }, []);

    const unregisterTab = useCallback((id: string) => {
        setTabs((prevTabs) => prevTabs.filter((tab) => tab.id !== id));
    }, []);

    // Tabs are already sorted in registerTab, but we keep this as a safety net
    const sortedTabs = useMemo(() => {
        return [...tabs].sort((a, b) => {
            // Use the editor component index if available, otherwise fall back to the tab index
            const aIndex = a.editorComponentValues?.index || 0;
            const bIndex = b.editorComponentValues?.index || 0;
            return aIndex - bIndex;
        });
    }, [tabs]);

    // Reset active tab index if it's out of bounds
    useEffect(() => {
        if (tabs.length > 0 && activeTabIndex >= tabs.length) {
            setActiveTabIndex(0);
        }
    }, [tabs, activeTabIndex]);

    useEffect(() => {
        if (anchor != null) {
            const tabIndex = sortedTabs.findIndex((tab) => tab.id === anchor);
            if (tabIndex >= 0) {
                setActiveTabIndex(tabIndex);
            }
        }
    }, [anchor, sortedTabs]);

    useEffect(() => {
        if (selectedLanguage) {
            const matchingTabIndex = sortedTabs.findIndex(
                (tab) => tab.language && ApiDefinition.cleanLanguage(tab.language) === selectedLanguage
            );
            if (matchingTabIndex >= 0) {
                setActiveTabIndex((prevActiveTabIndex) => {
                    const prevTab = sortedTabs[prevActiveTabIndex];
                    if (prevTab?.language && ApiDefinition.cleanLanguage(prevTab.language) === selectedLanguage) {
                        return prevActiveTabIndex;
                    }
                    return matchingTabIndex;
                });
            }
        }
    }, [selectedLanguage, sortedTabs]);

    const handleTabChange = (tabId: string) => {
        const tabIndex = sortedTabs.findIndex((tab) => tab.id === tabId);
        if (tabIndex >= 0) {
            setActiveTabIndex(tabIndex);
            const selectedTab = sortedTabs[tabIndex];
            const cleanedLanguage = selectedTab?.language
                ? ApiDefinition.cleanLanguage(selectedTab.language)
                : undefined;
            if (cleanedLanguage && cleanedLanguage !== selectedLanguage) {
                setSelectedLanguage(cleanedLanguage);
            }
        }
    };

    const contextValue = useMemo(
        () => ({
            registerTab,
            unregisterTab,
            tabs
        }),
        [registerTab, unregisterTab, tabs]
    );

    // Get the current active tab ID based on the index
    const activeTabId = sortedTabs[activeTabIndex]?.id || "";

    return (
        <TabsContext.Provider value={contextValue}>
            <RadixTabs.Root value={activeTabId} onValueChange={handleTabChange}>
                <RadixTabs.List className="border-border-default mb-6 mt-4 flex gap-4 overflow-x-auto overflow-y-hidden border-b first:-mt-3">
                    {sortedTabs.map((tab) => {
                        const { title = "Untitled", id, editorComponentValues } = tab;

                        if (isWithinEditor && editorComponentValues) {
                            // Wrap each tab header in EditorComponentProvider with the values from the Tab
                            return (
                                <EditorComponentProvider key={id} {...editorComponentValues}>
                                    <TabHeader id={id} title={title} tabs={sortedTabs} />
                                </EditorComponentProvider>
                            );
                        }

                        return (
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
                        );
                    })}
                    {isWithinEditor && (
                        <div className="flex items-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="select-none"
                                onClick={() => {
                                    appendChildrenMdx(EMPTY_TAB_CONTENT);
                                }}
                            >
                                <CirclePlusIcon />
                                Add tab
                            </Button>
                        </div>
                    )}
                </RadixTabs.List>
                {isWithinEditor ? <div className="mb-6">{children}</div> : <>{children}</>}
            </RadixTabs.Root>
        </TabsContext.Provider>
    );
}

export function Tab({
    id,
    title = "Untitled",
    toc,
    language,
    children
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
    /**
     * the index of the tab (injected by TabGroup)
     * @internal
     */
    index?: number;
}) {
    const { registerTab, unregisterTab } = useTabsContext();
    const uniqueId = React.useId();
    const tabId = id || `tab-${uniqueId}`;

    // Get the editor component values if we're within the editor
    const editorComponentValues = useEditorComponent();

    useEffect(() => {
        registerTab({
            id: tabId,
            title,
            language,
            toc,
            // Pass the editor component values to the TabGroup
            editorComponentValues: editorComponentValues.isWithinEditor ? editorComponentValues : undefined
        });

        return () => {
            unregisterTab(tabId);
        };
    }, [tabId, title, language, toc, registerTab, unregisterTab, editorComponentValues]);

    return (
        <RadixTabs.Content
            value={tabId}
            className={cn(
                "border:content-[''] before:mb-4 before:block",
                "[&_.react-renderer]:px-0",
                "[&_.react-renderer>[data-node-view-wrapper]]:px-0"
            )}
        >
            {children}
        </RadixTabs.Content>
    );
}
