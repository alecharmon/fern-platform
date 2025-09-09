"use client";

import { useRouter } from "next/navigation";
import React from "react";

import { isEqual } from "es-toolkit/predicate";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { z } from "zod";

import { cn } from "@fern-docs/components";
import { useFernUser } from "@fern-docs/components/state/fern-user";
import {
  AlgoliaSearchClientRoot,
  DesktopAskAiPanel,
  SEARCH_INDEX,
} from "@fern-docs/search-ui";
import { useEventCallback } from "@fern-ui/react-commons";

import { useApiRoute } from "@/components/hooks/useApiRoute";
import { useApiRouteSWRImmutable } from "@/components/hooks/useApiRouteSWR";
import { useIsDarkCode } from "@/state/dark-code";
import { useIsSearchDialogOpen } from "@/state/search";
import {
  pageContextAtom,
  searchPanelInitialInputAtom,
  searchPanelInitializedAtom,
  useIsSearchPanelResizing,
  usePageContext,
  useSetSearchPanelResizing,
} from "@/state/search-panel";
import { searchPanelOpenAtom } from "@/state/search-panel";

import { Feedback } from "./feedback/Feedback";
import { generateConversationId } from "./generate-conversation-id";
import { generateQueryId } from "./generate-query-id";
import { useAlgoliaUserToken } from "./util/getAlgoliaUserToken";

const ApiKeySchema = z.object({
  appId: z.string(),
  apiKey: z.string(),
});

export const conversationIdAtom = atom<string>(generateConversationId());
export function useConversationId() {
  const [conversationId, setConversationId] = useAtom(conversationIdAtom);
  return {
    conversationId,
    setConversationId,
    resetConversationId: () => setConversationId(generateConversationId()),
  };
}

export const queryIdAtom = atom<string>(generateQueryId());
export function useQueryId() {
  const [queryId, setQueryId] = useAtom(queryIdAtom);
  return {
    queryId,
    setQueryId,
    resetQueryId: () => setQueryId(generateQueryId()),
  };
}

const getDefaultWidth = () => {
  if (typeof window !== "undefined") {
    const vw = window.innerWidth;
    const minWidth = Math.min(344, vw * 0.4);
    const defaultWidth = vw * 0.2;
    return Math.max(minWidth, Math.min(defaultWidth, vw * 0.4));
  }
  return 344;
};

const widthAtom = atom(getDefaultWidth());

export const SearchPanel = React.memo(function SearchPanel({
  domain,
}: {
  domain: string;
}) {
  const isDarkCodeEnabled = useIsDarkCode();
  const userToken = useAlgoliaUserToken();
  const user = useFernUser();

  const [isOpen, setIsOpen] = useCommandTrigger();
  const isResizing = useIsSearchPanelResizing();
  const setIsResizing = useSetSearchPanelResizing();
  const searchDialogOpen = useIsSearchDialogOpen();
  const [width, setWidth] = useAtom(widthAtom);
  const conversationIdHook = useConversationId();
  const queryIdHook = useQueryId();

  React.useEffect(() => {
    if (!isOpen) {
      setWidth(0);
    } else if (width === 0) {
      setWidth(getDefaultWidth());
    }
  }, [isOpen, width, setWidth]);

  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--ask-ai-panel-width",
      `${width}px`
    );
  }, [width]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const vw = window.innerWidth;
      const newWidth = vw - e.clientX;
      const minWidth = Math.min(344, vw * 0.2);
      const maxWidth = vw * 0.4;

      setWidth(Math.max(minWidth, Math.min(newWidth, maxWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setIsResizing, setWidth, isResizing, width]);

  React.useEffect(() => {
    const handleToggleSize = (event: CustomEvent) => {
      if (typeof window !== "undefined") {
        const vw = window.innerWidth;
        if (event.detail.isMaximized) {
          setWidth(vw * 0.4);
        } else {
          const minWidth = Math.min(344, vw * 0.4);
          const defaultWidth = vw * 0.2;
          setWidth(Math.max(minWidth, Math.min(defaultWidth, vw * 0.4)));
        }
      }
    };

    window.addEventListener(
      "search-panel:toggle-size",
      handleToggleSize as EventListener
    );
    return () => {
      window.removeEventListener(
        "search-panel:toggle-size",
        handleToggleSize as EventListener
      );
    };
  }, [setWidth]);

  const [initialInput, setInitialInput] = useAtom(searchPanelInitialInputAtom);
  const setPageContext = useSetAtom(pageContextAtom);
  const pageContext = usePageContext();

  const { data } = useApiRouteSWRImmutable("/api/fern-docs/search/v2/key", {
    request: { headers: { "X-User-Token": userToken } },
    validate: ApiKeySchema,
    // api key expires 24 hours, so we refresh it every hour
    refreshInterval: 60 * 60 * 1000,
    preload: true,
  });

  let chatEndpoint = useApiRoute("/api/fern-docs/search/v2/chat");
  let suggestEndpoint = useApiRoute("/api/fern-docs/search/v2/suggest");

  // Rerouting to ferndocs.com for production environments to ensure streaming works
  // Also see: next.config.mjs, where we set CORS headers
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    chatEndpoint = `${process.env.NEXT_PUBLIC_CDN_URI}/api/fern-docs/search/v2/chat`;
    suggestEndpoint = `${process.env.NEXT_PUBLIC_CDN_URI}/api/fern-docs/search/v2/suggest`;
  }

  const router = useRouter();

  const handleNavigate = useEventCallback((path: string) => {
    router.push(path, { scroll: true });
  });

  const facetApiEndpoint = useApiRoute("/api/fern-docs/search/v2/facet");

  const setInitialized = useSetAtom(searchPanelInitializedAtom);
  // initialize the search dialog when the data is loaded
  React.useEffect(() => {
    setInitialized(data != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const facetFetcher = React.useCallback(
    async (filters: readonly string[]) => {
      if (!data) {
        return {};
      }
      const searchParams = new URLSearchParams();
      searchParams.append("apiKey", data.apiKey);
      filters.forEach((filter) => searchParams.append("filters", filter));
      const search = String(searchParams);
      const res = await fetch(`${facetApiEndpoint}?${search}`, {
        method: "GET",
      });
      return res.json();
    },
    [data, facetApiEndpoint]
  );

  if (!data) {
    return null;
  }

  const { apiKey, appId } = data;

  return (
    <AlgoliaSearchClientRoot
      appId={appId}
      apiKey={apiKey}
      domain={domain}
      indexName={SEARCH_INDEX}
      fetchFacets={facetFetcher}
      authenticatedUserToken={user?.email}
      analyticsTags={["search-v2-dialog"]}
    >
      <div
        className={cn(
          "bg-background border-border-default fixed inset-y-0 right-0 z-50 flex flex-col border-l transition-all duration-500 ease-out",
          "max-sm:inset-0 max-sm:!w-full max-sm:border-l-0", // Full screen on mobile
          isOpen ? "translate-x-0" : "translate-x-full",
          isResizing && "transition-none" // Disable transition while resizing
        )}
        style={{ width: `${width}px` }}
      >
        {/* Resize Handle - Hidden on mobile */}
        <div
          className={cn(
            "absolute bottom-0 left-0 top-0 z-10 w-2 cursor-col-resize bg-transparent",
            "max-sm:hidden", // Hide resize handle on mobile
            isResizing && "bg-primary/30",
            "-translate-x-1 transition-transform"
          )}
          onMouseDown={handleMouseDown}
          style={{ pointerEvents: "auto" }}
        />

        <div className="flex-1 overflow-y-auto">
          <DesktopAskAiPanel
            useConversationId={() => conversationIdHook}
            useQueryId={() => queryIdHook}
            domain={domain}
            api={chatEndpoint}
            headers={{
              "X-Fern-Host": domain,
            }}
            suggestionsApi={suggestEndpoint}
            initialInput={initialInput}
            setInitialInput={setInitialInput}
            body={{ algoliaSearchKey: apiKey }}
            onSelectHit={handleNavigate}
            onEscapeKeyDown={() => setIsOpen(false)}
            renderActions={({ user, assistant }, queryId) => {
              if (!assistant) {
                return null;
              }
              return (
                <Feedback
                  feedbackQuestion="Was this response helpful?"
                  type="conversational-search"
                  metadata={() => ({
                    user: user?.content,
                    assistant: assistant.content,
                    assistantId: assistant.id,
                    conversationId: conversationIdHook.conversationId,
                    queryId: queryId || queryIdHook.queryId,
                    domain,
                  })}
                  feedbackSource="ask-fern"
                />
              );
            }}
            darkCodeEnabled={isDarkCodeEnabled}
            className="shadow-xl"
            onClose={() => setIsOpen(false)}
            pageContext={pageContext}
            onRemovePageContext={() => setPageContext(null)}
            searchDialogOpen={searchDialogOpen}
            panelWidth={width}
          />
        </div>
      </div>
    </AlgoliaSearchClientRoot>
  );
}, isEqual);

function useCommandTrigger(): [
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>,
] {
  const [open, setOpen] = useAtom(searchPanelOpenAtom);
  const isInitialized = useAtomValue(searchPanelInitializedAtom);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      setOpen((prev) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "/") {
          event.preventDefault();
          if (isInitialized) {
            return !prev;
          }
        }

        return prev;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setOpen, isInitialized]);

  return [open, setOpen];
}

export default SearchPanel;
