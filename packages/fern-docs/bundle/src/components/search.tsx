"use client";

import { useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import { useIsDarkCode } from "@fern-docs/components/state/dark-code";
import { useFernUser } from "@fern-docs/components/state/fern-user";
import { useCurrentProductId, useCurrentVersionId } from "@fern-docs/components/state/navigation";
import { t } from "@fern-docs/i18n";
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
    SEARCH_INDEX
} from "@fern-docs/search-ui";
import { useEventCallback } from "@fern-ui/react-commons";
import { isEqual } from "es-toolkit/predicate";
import { atom, useAtom, useSetAtom } from "jotai";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { z } from "zod";
import { useApiRoute } from "@/components/hooks/useApiRoute";
import { useApiRouteSWRImmutable } from "@/components/hooks/useApiRouteSWR";
import { useSetTheme, useThemeSwitchEnabled } from "@/hooks/use-theme";
import {
    searchDialogOpenAtom,
    searchInitializedAtom,
    useIsAskAiEnabled,
    useIsDefaultSearchFilterOn
} from "@/state/search";
import { searchPanelInitialInputAtom, useOpenSearchPanel } from "@/state/search-panel";

import { Feedback } from "./feedback/Feedback";
import { generateConversationId } from "./generate-conversation-id";
import { generateQueryId } from "./generate-query-id";
import { useAlgoliaUserToken } from "./util/getAlgoliaUserToken";

const ApiKeySchema = z.object({
    appId: z.string(),
    apiKey: z.string(),
    allBasepaths: z.array(z.string()).optional()
});

export const conversationIdAtom = atom<string>(generateConversationId());
export function useConversationId() {
    const [conversationId, setConversationId] = useAtom(conversationIdAtom);
    return {
        conversationId,
        setConversationId,
        resetConversationId: () => setConversationId(generateConversationId())
    };
}

export const queryIdAtom = atom<string>(generateQueryId());
export function useQueryId() {
    const [queryId, setQueryId] = useAtom(queryIdAtom);
    return {
        queryId,
        setQueryId,
        resetQueryId: () => setQueryId(generateQueryId())
    };
}

export const SearchV2 = React.memo(function SearchV2({
    domain,
    disableAnalytics,
    lang
}: {
    domain: string;
    disableAnalytics?: boolean;
    lang: string;
}) {
    const currentVersion = useCurrentVersionId();
    const currentProduct = useCurrentProductId();

    const isDarkCodeEnabled = useIsDarkCode();
    const userToken = useAlgoliaUserToken();
    const user = useFernUser();
    const isAskAiEnabled = useIsAskAiEnabled();
    const isDefaultSearchFilterOn = useIsDefaultSearchFilterOn();

    const [open, setOpen] = useCommandTrigger();
    const [initialInput, setInitialInput] = useAtom(searchPanelInitialInputAtom);
    const [initialQuery, setInitialQuery] = React.useState<string | undefined>(undefined);
    const openSearchPanel = useOpenSearchPanel();
    const conversationIdHook = useConversationId();
    const queryIdHook = useQueryId();

    const { data } = useApiRouteSWRImmutable("/api/fern-docs/search/v2/key", {
        request: { headers: { "X-User-Token": userToken } },
        validate: ApiKeySchema,
        // api key expires 24 hours, so we refresh it every hour
        refreshInterval: 60 * 60 * 1000,
        preload: true
    });

    const shouldApplyVersionFilter = currentVersion != null && isDefaultSearchFilterOn;
    const shouldApplyProductFilter = currentProduct != null && isDefaultSearchFilterOn;

    const facetApiEndpoint = useApiRoute("/api/fern-docs/search/v2/facet");

    const router = useRouter();

    // For multi-repo domains, the domain prop includes the basepath but is URL-encoded
    // (e.g., "example.com%2Fnemo"). Decode it to extract the basepath.
    const decodedDomain = React.useMemo(() => {
        try {
            return decodeURIComponent(domain);
        } catch {
            return domain;
        }
    }, [domain]);

    const domainBasePath = React.useMemo(() => {
        const slashIndex = decodedDomain.indexOf("/");
        return slashIndex >= 0 ? decodedDomain.slice(slashIndex) : undefined;
    }, [decodedDomain]);

    // Extract pure domain (without basepath) for the X-Fern-Host header.
    // For basepath-aware domains, decodedDomain is "docs.nvidia.com/heavyai" but
    // the server expects just "docs.nvidia.com" as the host.
    const pureDomain = domainBasePath ? decodedDomain.slice(0, decodedDomain.indexOf("/")) : decodedDomain;

    const allBasepaths = data?.allBasepaths;

    const handleNavigate = useEventCallback((path: string) => {
        // For multi-repo domains, navigating across basepaths requires a full page load
        // because each basepath is a separate docs instance. Client-side routing (router.push)
        // will hang because the Next.js app shell was loaded for a different basepath's docs definition.
        if (allBasepaths != null && allBasepaths.length > 0) {
            const targetBasepath = getLongestMatchingBasepath(path, allBasepaths);
            if (targetBasepath !== domainBasePath) {
                window.location.href = path;
                setOpen(false);
                return;
            }
        }
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
                method: "GET"
            });
            return res.json();
        },
        [data, facetApiEndpoint]
    );

    const setInitialized = useSetAtom(searchInitializedAtom);
    // initialize the search dialog when the data is loaded
    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when data changes
    React.useEffect(() => {
        setInitialized(data != null);
    }, [data]);

    // close the search dialog when the pathname changes
    const pathname = useCurrentPathname();
    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when pathname changes
    React.useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Handle deep linking via URL parameters
    const searchParams = useSearchParams();
    const deepLinkHandledRef = React.useRef(false);
    React.useEffect(() => {
        if (deepLinkHandledRef.current || !data) {
            return;
        }

        const searchType = searchParams.get("searchType");
        const query = searchParams.get("query");

        // If neither searchType nor query is provided, don't open search
        if (!searchType && !query) {
            return;
        }

        deepLinkHandledRef.current = true;

        if (searchType === "ai" && isAskAiEnabled) {
            // Open the AI search panel with the query
            if (query) {
                setInitialInput(query);
            }
            openSearchPanel();
        } else {
            // Open the regular search dialog for:
            // - searchType=semantic
            // - searchType=ai when AI is not enabled (fallback)
            // - No searchType provided (default to semantic)
            if (query) {
                setInitialQuery(query);
            }
            setOpen(true);
        }

        // Clean up URL parameters after handling
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("searchType");
            url.searchParams.delete("query");
            window.history.replaceState({}, "", url.toString());
        }
    }, [searchParams, data, isAskAiEnabled, setInitialInput, openSearchPanel, setOpen]);

    if (!data) {
        return null;
    }

    const { appId, apiKey } = data;

    const children = (
        <>
            <DefaultDesktopBackButton lang={lang} />
            <CommandGroupFilters lang={lang} />
            <CommandEmpty lang={lang} />
            <CommandSearchHits
                onSelect={handleNavigate}
                prefetch={(path) => router.prefetch(path)}
                domain={decodedDomain}
                currentVersion={currentVersion}
                currentProduct={currentProduct}
            />
            <CommandActions>
                <CommandTheme
                    onClose={() => {
                        setOpen(false);
                    }}
                    lang={lang}
                />
            </CommandActions>
        </>
    );

    const initialFilters: Record<string, string> = {};
    if (shouldApplyVersionFilter) {
        initialFilters["version.title"] = currentVersion;
    }
    if (shouldApplyProductFilter) {
        initialFilters["product.title"] = currentProduct;
    }

    // Build optional filters to boost (not filter) results matching the current product/version
    // in Algolia's ranking. This ensures the first page of results already prioritizes items
    // from the current product/version, rather than relying solely on client-side re-sorting.
    const optionalFilters: string[] = [];
    if (currentProduct != null) {
        optionalFilters.push(`product.title:${currentProduct}`);
    }
    if (currentVersion != null) {
        optionalFilters.push(`version.title:${currentVersion}`);
    }

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
                initialFilters={Object.keys(initialFilters).length > 0 ? initialFilters : undefined}
            >
                <DesktopSearchDialog open={open} onOpenChange={setOpen} lang={lang}>
                    <DesktopCommand
                        onEscapeKeyDown={() => setOpen(false)}
                        className="shadow-xl"
                        lang={lang}
                        initialQuery={initialQuery}
                        onInitialQueryApplied={() => setInitialQuery(undefined)}
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
            domain={decodedDomain}
            indexName={SEARCH_INDEX}
            fetchFacets={facetFetcher}
            authenticatedUserToken={user?.email}
            initialFilters={Object.keys(initialFilters).length > 0 ? initialFilters : undefined}
            analyticsTags={disableAnalytics ? [] : ["search-v2-dialog"]}
            optionalFilters={optionalFilters.length > 0 ? optionalFilters : undefined}
        >
            <DesktopSearchDialog open={open} onOpenChange={setOpen} lang={lang}>
                {isAskAiEnabled ? (
                    <DesktopCommandWithAskAI
                        useConversationId={() => conversationIdHook}
                        domain={decodedDomain}
                        headers={{
                            "X-Fern-Host": pureDomain
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
                                    feedbackQuestion={t(lang).feedback.wasThisResponseHelpful}
                                    type="conversational-search"
                                    metadata={() => ({
                                        user: user?.content,
                                        assistant: assistant.content,
                                        conversationId: conversationIdHook.conversationId,
                                        queryId: queryId || queryIdHook.queryId,
                                        domain
                                    })}
                                    feedbackSource="ask-fern"
                                    lang={lang}
                                />
                            );
                        }}
                        darkCodeEnabled={isDarkCodeEnabled}
                        className="shadow-xl"
                        openSearchPanel={openSearchPanel}
                        lang={lang}
                        initialQuery={initialQuery}
                        onInitialQueryApplied={() => setInitialQuery(undefined)}
                    >
                        {children}
                    </DesktopCommandWithAskAI>
                ) : (
                    <DesktopCommand
                        onEscapeKeyDown={() => setOpen(false)}
                        className="shadow-xl"
                        lang={lang}
                        initialQuery={initialQuery}
                        onInitialQueryApplied={() => setInitialQuery(undefined)}
                    >
                        {children}
                    </DesktopCommand>
                )}
            </DesktopSearchDialog>
        </AlgoliaSearchClientRoot>
    );
}, isEqual);

function CommandTheme({ onClose, lang }: { onClose: () => void; lang: string }) {
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
            lang={lang}
        />
    );
}

function useCommandTrigger(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
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
                    !isEditableElement(getDeepActiveElement()) &&
                    !(event.target instanceof Element && isEditableElement(event.target))
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

/**
 * Traverses shadow roots to find the actual focused element.
 */
function getDeepActiveElement(): Element | null {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) {
        active = active.shadowRoot.activeElement;
    }
    return active;
}

function isEditableElement(element: Element | null): boolean {
    if (!element) {
        return false;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return true;
    }
    if (element instanceof HTMLElement) {
        if (element.isContentEditable) {
            return true;
        }
        const role = element.getAttribute("role");
        if (role === "textbox" || role === "searchbox" || role === "combobox") {
            return true;
        }
    }
    return false;
}

function getLongestMatchingBasepath(path: string, basepaths: string[]): string | undefined {
    const sorted = [...basepaths].sort((a, b) => b.length - a.length);
    for (const bp of sorted) {
        if (path === bp || path.startsWith(`${bp}/`)) {
            return bp;
        }
    }
    return undefined;
}

export default SearchV2;
