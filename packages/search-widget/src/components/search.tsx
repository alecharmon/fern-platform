"use client";

import {
    CommandEmpty,
    CommandGroupFilters,
    CommandSearchHits,
    DefaultDesktopBackButton,
    DesktopSearchDialog
} from "@fern-docs/search-ui";
import { AskAiStandaloneModal } from "@fern-docs/search-ui/components/desktop/ask-ai-modal";
import { AlgoliaSearchClientRoot } from "@fern-docs/search-ui/components/search/algolia-search-client";
import { TooltipProvider } from "@fern-docs/search-ui/components/ui/tooltip";
import { useLazyRef } from "@fern-ui/react-commons";
import { atom, Provider, useAtom, useAtomValue } from "jotai";
import React, { forwardRef } from "react";
import z from "zod";

import { useApiRoute } from "@/hooks/useApiRoute";
import { searchDialogOpenAtom, useConversationId } from "@/state/search";
import { generateQueryId } from "@/utils/generateQueryId";

import "../styles/desktop.scss";
import { atomWithStorageString } from "../utils/atomWithStorageString";

const SEARCH_INDEX = "fern_docs_search";

const ApiKeySchema = z.object({
    appId: z.string(),
    apiKey: z.string()
});

type ApiKeyData = z.infer<typeof ApiKeySchema>;

const askAIAtom = atom(false);

export interface SearchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: React.ReactNode;
    lang?: string;
    domain: string;
}

const ALGOLIA_USER_TOKEN_KEY = "algolia-user-token";

function useAlgoliaUserToken() {
    const userTokenRef = useLazyRef(() =>
        atomWithStorageString(ALGOLIA_USER_TOKEN_KEY, `anonymous-user-${crypto.randomUUID()}`, { getOnInit: true })
    );
    return useAtomValue(userTokenRef.current);
}

const queryIdAtom = atom<string>(generateQueryId());
function useQueryId() {
    const [queryId, setQueryId] = useAtom(queryIdAtom);
    return {
        queryId,
        setQueryId,
        resetQueryId: () => setQueryId(generateQueryId())
    };
}

const SearchModalInner = forwardRef<HTMLButtonElement, SearchButtonProps>(
    ({ className, icon, lang = "en", domain, ...props }, ref) => {
        const userToken = useAlgoliaUserToken();
        const conversationIdHook = useConversationId();
        const [open, setOpen] = useAtom(searchDialogOpenAtom);
        const [askAI, setAskAI] = useAtom(askAIAtom);

        const queryIdHook = useQueryId();

        // Fetch API key
        const apiKeyUrl = useApiRoute(`/api/fern-docs/search/v2/key`, domain);
        const [data, setData] = React.useState<ApiKeyData | undefined>(undefined);
        const [isLoading, setIsLoading] = React.useState(true);

        React.useEffect(() => {
            let cancelled = false;

            const fetchApiKey = async () => {
                try {
                    const response = await fetch(apiKeyUrl, {
                        headers: { "X-User-Token": userToken }
                    });
                    const json = await response.json();
                    const validated = ApiKeySchema.parse(json);

                    if (!cancelled) {
                        setData(validated);
                        setIsLoading(false);
                    }
                } catch (_error) {
                    if (!cancelled) {
                        // biome-ignore lint/suspicious/noConsole: allow logging error for API key fetch failure
                        console.error("Failed to fetch API key:", _error);
                        setIsLoading(false);
                    }
                }
            };

            fetchApiKey();

            return () => {
                cancelled = true;
            };
        }, [apiKeyUrl, userToken]);

        let chatEndpoint = useApiRoute(`/api/fern-docs/search/v2/chat`, domain);
        const facetApiEndpoint = useApiRoute(`/api/fern-docs/search/v2/facet`, domain);

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
                    method: "GET"
                });
                return res.json();
            },
            [data, facetApiEndpoint]
        );

        if (isLoading) {
            return (
                <button ref={ref} {...props} disabled>
                    Loading...
                </button>
            );
        }

        if (!data) {
            return null;
        }

        const { apiKey, appId } = data;

        const children = (
            <>
                <DefaultDesktopBackButton lang={lang} />
                <CommandGroupFilters lang={lang} />
                <CommandEmpty lang={lang} />
                <CommandSearchHits onSelect={() => {}} prefetch={(path) => {}} domain={domain} forceWindowOpen={true} />
            </>
        );

        return (
            <AlgoliaSearchClientRoot
                appId={appId}
                apiKey={apiKey}
                domain={domain}
                indexName={SEARCH_INDEX}
                fetchFacets={facetFetcher}
                initialFilters={undefined}
                analyticsTags={["search-v2-dialog"]}
            >
                <TooltipProvider>
                    <button
                        ref={ref}
                        {...props}
                        className={`fern-search-button ${className || ""}`}
                        onClick={() => setOpen(true)}
                    >
                        {props.children}
                    </button>
                    <DesktopSearchDialog open={open} onOpenChange={setOpen} lang={lang}>
                        <AskAiStandaloneModal
                            useConversationId={() => conversationIdHook}
                            useQueryId={() => queryIdHook}
                            domain={domain}
                            askAI={askAI}
                            setAskAI={setAskAI}
                            api={chatEndpoint}
                            body={{ algoliaSearchKey: apiKey }}
                            lang={lang}
                            onEscapeKeyDown={() => setOpen(false)}
                        >
                            {children}
                        </AskAiStandaloneModal>
                    </DesktopSearchDialog>
                </TooltipProvider>
            </AlgoliaSearchClientRoot>
        );
    }
);
SearchModalInner.displayName = "SearchModalInner";

export const SearchModal = forwardRef<HTMLButtonElement, SearchButtonProps>((props, ref) => {
    return (
        <Provider>
            <SearchModalInner {...props} ref={ref} />
        </Provider>
    );
});
SearchModal.displayName = "SearchButton";
