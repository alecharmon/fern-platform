"use client";

import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { useIsDarkCode } from "@fern-docs/components/state/dark-code";
import { useFernUser } from "@fern-docs/components/state/fern-user";
import { AlgoliaSearchClientRoot, DesktopAskAiPanel, SEARCH_INDEX } from "@fern-docs/search-ui";
import { useEventCallback, useMinWidth } from "@fern-ui/react-commons";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { isEqual } from "es-toolkit/predicate";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import React from "react";
import { Drawer } from "vaul";
import { z } from "zod";

import { useApiRoute } from "@/components/hooks/useApiRoute";
import { useApiRouteSWRImmutable } from "@/components/hooks/useApiRouteSWR";
import { useIsSearchDialogOpen } from "@/state/search";
import {
    pageContextAtom,
    searchPanelDraftInputAtom,
    searchPanelInitialInputAtom,
    searchPanelInitializedAtom,
    searchPanelOpenAtom,
    useIsSearchPanelOpen,
    useIsSearchPanelResizing,
    usePageContext,
    useSetSearchPanelResizing
} from "@/state/search-panel";

import { SearchPanelFeedback } from "./feedback/SearchPanelFeedback";
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

const getDefaultWidth = () => {
    if (typeof window !== "undefined") {
        const vw = window.innerWidth;
        const minWidth = Math.min(344, vw * 0.4);
        const defaultWidth = vw * 0.2;
        return Math.max(minWidth, Math.min(defaultWidth, vw * 0.4));
    }
    return 344;
};

// Initialize to 0 so panel doesn't flash on load. Width is set when panel opens
const widthAtom = atom(0);

export const SearchPanel = React.memo(function SearchPanel({
    domain,
    lang,
    hideFeedback = false
}: {
    domain: string;
    lang: string;
    hideFeedback?: boolean;
}) {
    const isDarkCodeEnabled = useIsDarkCode();
    const userToken = useAlgoliaUserToken();
    const user = useFernUser();

    const [isOpen, setIsOpen] = useCommandTrigger();
    const isResizing = useIsSearchPanelResizing();
    const isSidePanelOpen = useIsSearchPanelOpen();
    const setIsResizing = useSetSearchPanelResizing();
    const searchDialogOpen = useIsSearchDialogOpen();
    const [width, setWidth] = useAtom(widthAtom);
    const isDesktopBreakpoint = useMinWidth(768);
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
        // On mobile/tablet (< md breakpoint), the drawer overlays content
        // so don't shift the main layout
        document.documentElement.style.setProperty("--ask-ai-panel-width", isDesktopBreakpoint ? `${width}px` : "0px");
    }, [width, isDesktopBreakpoint]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    };

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) {
                return;
            }

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
    }, [setIsResizing, setWidth, isResizing]);

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

        window.addEventListener("search-panel:toggle-size", handleToggleSize as EventListener);
        return () => {
            window.removeEventListener("search-panel:toggle-size", handleToggleSize as EventListener);
        };
    }, [setWidth]);

    const [initialInput, setInitialInput] = useAtom(searchPanelInitialInputAtom);
    const [draftInput, setDraftInput] = useAtom(searchPanelDraftInputAtom);
    const setPageContext = useSetAtom(pageContextAtom);
    const pageContext = usePageContext();

    const { data } = useApiRouteSWRImmutable("/api/fern-docs/search/v2/key", {
        request: { headers: { "X-User-Token": userToken } },
        validate: ApiKeySchema,
        // api key expires 24 hours, so we refresh it every hour
        refreshInterval: 60 * 60 * 1000,
        preload: true
    });

    let chatEndpoint = useApiRoute("/api/fern-docs/search/v2/chat");

    // Rerouting to ferndocs.com for production environments to ensure streaming works
    // Also see: next.config.mjs, where we set CORS headers
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
        chatEndpoint = `${process.env.NEXT_PUBLIC_CDN_URI?.replace(/\/+$/, "")}/api/fern-docs/search/v2/chat`;
    }

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
            // The path may be a full URL (e.g. from the context pill) or just a pathname
            // (e.g. from CommandLink). Extract just the pathname for basepath matching.
            const pathname = toPathname(path);
            const targetBasepath = getLongestMatchingBasepath(pathname, allBasepaths);
            if (targetBasepath !== domainBasePath) {
                window.location.href = path;
                return;
            }
        }
        router.push(path, { scroll: true });
    });

    const facetApiEndpoint = useApiRoute("/api/fern-docs/search/v2/facet");

    const setInitialized = useSetAtom(searchPanelInitializedAtom);
    // initialize the search dialog when the data is loaded
    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when data changes
    React.useEffect(() => {
        setInitialized(data != null);
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
                method: "GET"
            });
            return res.json();
        },
        [data, facetApiEndpoint]
    );

    if (!data) {
        return null;
    }

    const { apiKey, appId } = data;

    const panelContent = (
        <DesktopAskAiPanel
            useConversationId={() => conversationIdHook}
            useQueryId={() => queryIdHook}
            domain={decodedDomain}
            api={chatEndpoint}
            headers={{
                "X-Fern-Host": pureDomain
            }}
            initialInput={initialInput}
            setInitialInput={setInitialInput}
            draftInput={draftInput}
            setDraftInput={setDraftInput}
            body={{ algoliaSearchKey: apiKey }}
            onSelectHit={handleNavigate}
            onEscapeKeyDown={() => setIsOpen(false)}
            renderActions={({ user, assistant }, queryId) => {
                if (!assistant) {
                    return null;
                }
                const copyButton = (
                    <CopyToClipboardButton content={assistant.content} lang={lang} className="h-8 w-8 p-0" />
                );
                if (hideFeedback) {
                    return <div className="flex items-center gap-2">{copyButton}</div>;
                }
                return (
                    <SearchPanelFeedback
                        metadata={() => ({
                            user: user?.content,
                            assistant: assistant.content,
                            assistantId: assistant.id,
                            conversationId: conversationIdHook.conversationId,
                            queryId: queryId || queryIdHook.queryId,
                            domain
                        })}
                        lang={lang}
                        copyAction={copyButton}
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
            isSidePanelOpen={isSidePanelOpen}
            lang={lang}
        />
    );

    return (
        <AlgoliaSearchClientRoot
            appId={appId}
            apiKey={apiKey}
            domain={decodedDomain}
            indexName={SEARCH_INDEX}
            fetchFacets={facetFetcher}
            authenticatedUserToken={user?.email}
            analyticsTags={["search-v2-dialog"]}
        >
            {/* Desktop: fixed side panel (always mounted to preserve chat history) */}
            <div
                className={cn(
                    "bg-background border-border-default fixed inset-y-0 right-0 z-50 flex flex-col border-l",
                    "max-md:hidden", // Hidden on mobile/tablet - use drawer instead
                    isResizing && "transition-none",
                    !isOpen && "hidden"
                )}
                style={{ width: `${width}px` }}
            >
                {/* Resize Handle */}
                <div
                    className={cn(
                        "absolute bottom-0 left-0 top-0 z-10 w-2 cursor-col-resize bg-transparent",
                        isResizing && "bg-primary/30",
                        "-translate-x-1 transition-transform"
                    )}
                    onMouseDown={handleMouseDown}
                />

                <div className="flex-1 overflow-y-auto">{panelContent}</div>
            </div>

            {/* Mobile/Tablet: bottom drawer */}
            <MobileDrawer isOpen={isOpen && !isDesktopBreakpoint} setIsOpen={setIsOpen}>
                {panelContent}
            </MobileDrawer>
        </AlgoliaSearchClientRoot>
    );
}, isEqual);

function useCommandTrigger(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
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

/**
 * Mobile drawer for the Ask AI panel. We disable vaul's `repositionInputs` and
 * handle keyboard positioning ourselves so the drawer sits right above the keyboard
 * with no dead space.
 */
function MobileDrawer({
    isOpen,
    setIsOpen,
    children
}: {
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    children: React.ReactNode;
}) {
    const [keyboardStyle, setKeyboardStyle] = React.useState<React.CSSProperties | undefined>(undefined);

    // Only listen to VisualViewport changes while the drawer is open.
    // This prevents Chrome from scrolling the page when the drawer isn't visible.
    React.useEffect(() => {
        if (!isOpen) {
            setKeyboardStyle(undefined);
            return;
        }

        const vv = window.visualViewport;
        if (!vv) {
            return;
        }

        const update = () => {
            const keyboardHeight = window.innerHeight - (vv.height + vv.offsetTop);
            if (keyboardHeight > 100) {
                setKeyboardStyle({
                    bottom: keyboardHeight,
                    height: `${vv.height * 0.85}px`
                });
            } else {
                setKeyboardStyle(undefined);
            }
        };

        vv.addEventListener("resize", update);
        return () => vv.removeEventListener("resize", update);
    }, [isOpen]);

    return (
        <Drawer.Root open={isOpen} onOpenChange={setIsOpen} noBodyStyles repositionInputs={false}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 md:hidden" />
                <Drawer.Content
                    className="bg-background fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col rounded-t-2xl md:hidden"
                    style={keyboardStyle}
                >
                    <Drawer.Handle className="bg-(--grayscale-a4) mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full" />
                    <VisuallyHidden>
                        <Drawer.Title>{"AI Assistant"}</Drawer.Title>
                        <Drawer.Description>{"Ask questions about the documentation."}</Drawer.Description>
                    </VisuallyHidden>
                    <div className="flex-1 overflow-y-auto">{children}</div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

function toPathname(pathOrUrl: string): string {
    try {
        return new URL(pathOrUrl).pathname;
    } catch {
        return pathOrUrl;
    }
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

export default SearchPanel;
