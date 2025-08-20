"use client";

import React from "react";

import { composeEventHandlers } from "@radix-ui/primitive";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { FERN_SEARCH_BUTTON_ID } from "@fern-docs/components/constants";
import { DesktopSearchButton } from "@fern-docs/search-ui/components/desktop/desktop-search-button";
import { useIsMobile } from "@fern-ui/react-commons";

export const searchDialogOpenAtom = atom(false);
export const searchInitializedAtom = atom(false);
export const isAskAiEnabledAtom = atom(false);

export const SetIsAskAiEnabled = ({
  isAskAiEnabled,
}: {
  isAskAiEnabled: boolean;
}) => {
  useHydrateAtoms([[isAskAiEnabledAtom, isAskAiEnabled]], {
    dangerouslyForceHydrate: true,
  });
  return null;
};

export const useIsAskAiEnabled = () => {
  return useAtomValue(isAskAiEnabledAtom);
};

export const isDefaultSearchFilterOnAtom = atom(false);

export const SetIsDefaultSearchFilterOn = ({
  isDefaultSearchFilterOn,
}: {
  isDefaultSearchFilterOn: boolean;
}) => {
  useHydrateAtoms([[isDefaultSearchFilterOnAtom, isDefaultSearchFilterOn]], {
    dangerouslyForceHydrate: true,
  });
  return null;
};

export const useIsDefaultSearchFilterOn = () => {
  return useAtomValue(isDefaultSearchFilterOnAtom);
};

searchInitializedAtom.onMount = (setInitialized) => {
  if (typeof window === "undefined") {
    return;
  }

  if (isLocal() || isSelfHosted()) {
    return;
  }

  const initialize = () => {
    setInitialized(true);
  };

  // enable other components to initialize the search state
  window.addEventListener("search:initialized", initialize);
  return () => {
    window.removeEventListener("search:initialized", initialize);
  };
};

export const SearchV2Trigger = React.memo(function SearchV2Trigger(
  props: React.ComponentProps<typeof DesktopSearchButton>
) {
  const isInitialized = useAtomValue(searchInitializedAtom);
  const toggleSearchDialog = useToggleSearchDialog();
  const isAskAiEnabled = useIsAskAiEnabled();
  const isMobile = useIsMobile();
  const isLocalEnvironment = isLocal();
  let placeholder = "Search";

  if (isAskAiEnabled && !isMobile) {
    placeholder = props.isSearchInSidebar
      ? "Search or ask AI"
      : "Search or ask AI a question";
  }

  return (
    <DesktopSearchButton
      /**
       * IMPORTANT: This component must be rendered only ONCE in the entire DOM tree,
       * because the ID must be unique across the entire document.
       */
      id={FERN_SEARCH_BUTTON_ID}
      {...props}
      onClick={composeEventHandlers(props.onClick, toggleSearchDialog)}
      variant={isInitialized && !isLocalEnvironment ? "default" : "loading"}
      placeholder={placeholder}
    />
  );
});

export function useIsSearchDialogOpen(): boolean {
  return useAtomValue(searchDialogOpenAtom);
}

export function useToggleSearchDialog(): () => void {
  const setSearchDialogState = useSetAtom(searchDialogOpenAtom);
  return () => setSearchDialogState((prev) => !prev);
}
