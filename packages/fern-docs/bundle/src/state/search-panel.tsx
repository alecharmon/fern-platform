"use client";

import React from "react";

import { atom, useAtomValue, useSetAtom } from "jotai";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { FernButton, cn } from "@fern-docs/components";
import {
  FERN_ASK_AI_BUTTON_ICON_ID,
  FERN_ASK_AI_BUTTON_ID,
} from "@fern-docs/components/constants";

import { SparklesIcon } from "@/components/PageActionsDropdownAssets";

export const searchPanelInitializedAtom = atom(false);
export const searchPanelOpenAtom = atom(false);
export const searchPanelResizingAtom = atom(false);
export const searchPanelInitialInputAtom = atom<string>("");

export interface PageContext {
  title: string;
  url: string;
}

export const pageContextAtom = atom<PageContext | null>(null);

export const SearchPanelTrigger = React.memo(function SearchPanelTrigger({
  isSearchInSidebar = false,
}: {
  isSearchInSidebar?: boolean;
}) {
  const isInitialized = useAtomValue(searchPanelInitializedAtom);
  const toggleAskAiSidePanel = useToggleSearchPanel();
  const isLocalEnvironment = isLocal();

  return (
    <FernButton
      id={FERN_ASK_AI_BUTTON_ID}
      variant="outlined"
      rightIcon={
        <SparklesIcon
          id={FERN_ASK_AI_BUTTON_ICON_ID}
          fill="var(--accent)"
          className="h-[16.667px] w-[16.667px]"
        />
      }
      text={isSearchInSidebar ? "" : "Ask AI"}
      className={cn(
        "text-(color:--grayscale-a11) h-9 w-fit flex-shrink-0 font-normal",
        isSearchInSidebar && "w-9",
        (!isInitialized || isLocalEnvironment) && "cursor-not-allowed"
      )}
      onClick={toggleAskAiSidePanel}
    />
  );
});

export function useIsSearchPanelOpen(): boolean {
  return useAtomValue(searchPanelOpenAtom);
}

export function useOpenSearchPanel(): () => void {
  const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
  return () => setSearchPanelState(true);
}

export function useCloseSearchPanel(): () => void {
  const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
  return () => setSearchPanelState(false);
}

export function useToggleSearchPanel(): () => void {
  const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
  return () => setSearchPanelState((prev) => !prev);
}

export function useIsSearchPanelResizing(): boolean {
  return useAtomValue(searchPanelResizingAtom);
}

export function useSetSearchPanelResizing(): (resizing: boolean) => void {
  const setResizingState = useSetAtom(searchPanelResizingAtom);
  return setResizingState;
}

export function usePageContext(): PageContext | null {
  return useAtomValue(pageContextAtom);
}

export function useSetPageContext(): (context: PageContext | null) => void {
  const setPageContext = useSetAtom(pageContextAtom);
  return setPageContext;
}
