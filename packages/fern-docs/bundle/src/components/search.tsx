"use client";

import { useRouter } from "next/navigation";
import React from "react";

import { isEqual } from "es-toolkit/predicate";
import { atom, useAtom, useSetAtom } from "jotai";
import { z } from "zod";

import { useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import { useFernUser } from "@fern-docs/components/state/fern-user";
import { useCurrentVersionId } from "@fern-docs/components/state/navigation";
import {
  AlgoliaSearchClientRoot,
  CommandActions,
  CommandEmpty,
  CommandGroupFilters,
  CommandGroupTheme,
  CommandSearchHits,
  DefaultDesktopBackButton,
  DesktopCommand,
  DesktopCommandWithAskAI,
  DesktopSearchDialog,
  MeiliSearchClientRoot,
  SEARCH_INDEX,
} from "@fern-docs/search-ui";
import { useEventCallback } from "@fern-ui/react-commons";

import { useApiRoute } from "@/components/hooks/useApiRoute";
import { useApiRouteSWRImmutable } from "@/components/hooks/useApiRouteSWR";
import { useSetTheme, useThemeSwitchEnabled } from "@/hooks/use-theme";
import { useIsDarkCode } from "@/state/dark-code";
import {
  searchDialogOpenAtom,
  searchInitializedAtom,
  useIsAskAiEnabled,
  useIsDefaultSearchFilterOn,
} from "@/state/search";
import { useOpenSearchPanel } from "@/state/search-panel";
import { searchPanelInitialInputAtom } from "@/state/search-panel";

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

export const SearchV2 = React.memo(function SearchV2({
  domain,
}: {
  domain: string;
}) {
  const currentVersion = useCurrentVersionId();

  const isDarkCodeEnabled = useIsDarkCode();
  const userToken = useAlgoliaUserToken();
  const user = useFernUser();
  const isAskAiEnabled = useIsAskAiEnabled();
  const isDefaultSearchFilterOn = useIsDefaultSearchFilterOn();

  const [open, setOpen] = useCommandTrigger();
  const [initialInput, setInitialInput] = useAtom(searchPanelInitialInputAtom);
  const openSearchPanel = useOpenSearchPanel();
  const conversationIdHook = useConversationId();
  const queryIdHook = useQueryId();

  const { data } = useApiRouteSWRImmutable("/api/fern-docs/search/v2/key", {
    request: { headers: { "X-User-Token": userToken } },
    validate: ApiKeySchema,
    // api key expires 24 hours, so we refresh it every hour
    refreshInterval: 60 * 60 * 1000,
    preload: true,
  });

  const shouldApplyVersionFilter =
    currentVersion != null && isDefaultSearchFilterOn;

  const facetApiEndpoint = useApiRoute("/api/fern-docs/search/v2/facet");

  const router = useRouter();

  const handleNavigate = useEventCallback((path: string) => {
    router.push(path, { scroll: true });
    setOpen(false);
  });

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

  const setInitialized = useSetAtom(searchInitializedAtom);
  // initialize the search dialog when the data is loaded
  React.useEffect(() => {
    setInitialized(data != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // close the search dialog when the pathname changes
  const pathname = useCurrentPathname();
  React.useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!data) {
    return null;
  }

  const { appId, apiKey } = data;

  const children = (
    <>
      <DefaultDesktopBackButton />
      <CommandGroupFilters />
      <CommandEmpty />
      <CommandSearchHits
        onSelect={handleNavigate}
        prefetch={(path) => router.prefetch(path)}
        domain={domain}
      />
      <CommandActions>
        <CommandTheme
          onClose={() => {
            setOpen(false);
          }}
        />
      </CommandActions>
    </>
  );

  if (process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1") {
    return (
      <MeiliSearchClientRoot
        host={
          typeof window !== "undefined"
            ? `${window.location.origin}${window.location.pathname.replace(/\/?$/, "/_search")}`
            : "/_search"
        }
        apiKey={""}
        indexName={SEARCH_INDEX}
        fetchFacets={facetFetcher}
        initialFilters={
          shouldApplyVersionFilter
            ? { "version.title": currentVersion }
            : undefined
        }
      >
        <DesktopSearchDialog open={open} onOpenChange={setOpen}>
          <DesktopCommand
            onEscapeKeyDown={() => setOpen(false)}
            className="shadow-xl"
          >
            {children}
          </DesktopCommand>
        </DesktopSearchDialog>
      </MeiliSearchClientRoot>
    );
  }
  return (
    <AlgoliaSearchClientRoot
      appId={appId}
      apiKey={apiKey}
      domain={domain}
      indexName={SEARCH_INDEX}
      fetchFacets={facetFetcher}
      authenticatedUserToken={user?.email}
      initialFilters={
        shouldApplyVersionFilter
          ? { "version.title": currentVersion }
          : undefined
      }
      analyticsTags={["search-v2-dialog"]}
    >
      <DesktopSearchDialog open={open} onOpenChange={setOpen}>
        {isAskAiEnabled ? (
          <DesktopCommandWithAskAI
            useConversationId={() => conversationIdHook}
            domain={domain}
            headers={{
              "X-Fern-Host": domain,
            }}
            initialInput={initialInput}
            setInitialInput={setInitialInput}
            body={{ algoliaSearchKey: apiKey }}
            onSelectHit={handleNavigate}
            onEscapeKeyDown={() => setOpen(false)}
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
            openSearchPanel={openSearchPanel}
          >
            {children}
          </DesktopCommandWithAskAI>
        ) : (
          <DesktopCommand
            onEscapeKeyDown={() => setOpen(false)}
            className="shadow-xl"
          >
            {children}
          </DesktopCommand>
        )}
      </DesktopSearchDialog>
    </AlgoliaSearchClientRoot>
  );
}, isEqual);

function CommandTheme({ onClose }: { onClose: () => void }) {
  const themeSwitchEnabled = useThemeSwitchEnabled();
  const setTheme = useSetTheme();
  if (!themeSwitchEnabled) {
    return null;
  }
  return (
    <CommandGroupTheme
      setTheme={(theme) => {
        setTheme(theme);
        onClose();
      }}
    />
  );
}

function useCommandTrigger(): [
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>,
] {
  const [open, setOpen] = useAtom(searchDialogOpenAtom);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (open) {
        return;
      }

      setOpen((prev) => {
        if (prev) {
          return prev;
        }

        // support for cmd+k
        if ((event.metaKey || event.ctrlKey) && event.key === "k") {
          event.preventDefault();
          return true;
        }

        // support for / key (only if not in an input)
        if (
          event.key === "/" &&
          !(event.metaKey || event.ctrlKey) &&
          !(document.activeElement instanceof HTMLInputElement) &&
          !(document.activeElement instanceof HTMLTextAreaElement) &&
          !(
            document.activeElement instanceof HTMLElement &&
            document.activeElement.isContentEditable
          )
        ) {
          event.preventDefault();
          return true;
        }
        return prev;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  return [open, setOpen];
}

export default SearchV2;
