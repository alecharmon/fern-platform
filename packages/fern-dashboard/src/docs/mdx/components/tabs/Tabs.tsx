import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import React from "react";

import * as RadixTabs from "@radix-ui/react-tabs";

import { ApiDefinition } from "@fern-api/fdr-sdk";
import { cn } from "@fern-docs/components";
import { useCurrentAnchor } from "@fern-docs/components/hooks/use-anchor";

import { useProgrammingLanguage } from "@/docs/state/language";

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

export function TabGroup({
  children,
}: {
  toc?: boolean;
  children?: ReactNode;
}) {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const anchor = useCurrentAnchor();
  const [selectedLanguage, setSelectedLanguage] = useProgrammingLanguage();

  const registerTab = useCallback((tab: TabData) => {
    setTabs((prevTabs) => {
      // Check if tab already exists
      const existingIndex = prevTabs.findIndex((t) => t.id === tab.id);
      if (existingIndex >= 0) {
        // Update existing tab
        const newTabs = [...prevTabs];
        newTabs[existingIndex] = tab;
        return newTabs;
      }
      // Add new tab
      return [...prevTabs, tab];
    });
  }, []);

  const unregisterTab = useCallback((id: string) => {
    setTabs((prevTabs) => prevTabs.filter((tab) => tab.id !== id));
  }, []);

  // Set initial active tab when tabs are registered
  useEffect(() => {
    if (tabs.length > 0 && !activeTab && tabs[0]) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (anchor != null) {
      if (tabs.some((tab) => tab.id === anchor)) {
        setActiveTab(anchor);
      }
    }
  }, [anchor, tabs]);

  useEffect(() => {
    if (selectedLanguage) {
      const matchingTab = tabs.find(
        (tab) =>
          tab.language &&
          ApiDefinition.cleanLanguage(tab.language) === selectedLanguage
      );
      if (matchingTab) {
        setActiveTab((prevActiveTab) => {
          const prevTab = tabs.find((tab) => tab.id === prevActiveTab);
          if (
            prevTab?.language &&
            ApiDefinition.cleanLanguage(prevTab.language) === selectedLanguage
          ) {
            return prevActiveTab;
          }
          return matchingTab.id;
        });
      }
    }
  }, [selectedLanguage, tabs]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const selectedTab = tabs.find((tab) => tab.id === tabId);
    const cleanedLanguage = selectedTab?.language
      ? ApiDefinition.cleanLanguage(selectedTab.language)
      : undefined;
    if (cleanedLanguage && cleanedLanguage !== selectedLanguage) {
      setSelectedLanguage(cleanedLanguage);
    }
  };

  const contextValue = useMemo(
    () => ({
      registerTab,
      unregisterTab,
      tabs,
    }),
    [registerTab, unregisterTab, tabs]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <RadixTabs.Root value={activeTab || ""} onValueChange={handleTabChange}>
        <RadixTabs.List className="border-border-default mb-6 mt-4 flex gap-4 overflow-x-auto overflow-y-hidden border-b first:-mt-3">
          {tabs.map(({ title = "Untitled", id }) => (
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
    </TabsContext.Provider>
  );
}

export function Tab({
  id,
  title = "Untitled",
  toc,
  language,
  children,
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
}) {
  const { registerTab, unregisterTab } = useTabsContext();
  const uniqueId = React.useId();
  const tabId = id || `tab-${uniqueId}`;

  useEffect(() => {
    registerTab({
      id: tabId,
      title,
      language,
      toc,
    });

    return () => {
      unregisterTab(tabId);
    };
  }, [tabId, title, language, toc, registerTab, unregisterTab]);

  return (
    <RadixTabs.Content
      value={tabId}
      className="border:content-[''] before:mb-4 before:block"
    >
      {children}
    </RadixTabs.Content>
  );
}
