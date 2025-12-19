"use client";

import { t } from "@fern-docs/i18n";
import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode, useRef } from "react";

import type { SqueezedMessage } from "../chatbot/utils";
import { useFacetFilters } from "../search/useFacetFilters";
import { CommandAskAIGroup } from "../shared";
import { DesktopCommandContent } from "./desktop-command";
import { DesktopCommandRoot } from "./desktop-command-root";

export const DesktopCommandWithAskAI = forwardRef<
    HTMLDivElement,
    Omit<ComponentPropsWithoutRef<typeof DesktopCommandRoot>, "children"> & {
        body?: object;
        headers?: Record<string, string>;
        initialInput?: string;
        setInitialInput?: (initialInput: string) => void;
        onSelectHit?: (path: string) => void;
        prefetch?: (path: string) => Promise<void>;
        composerActions?: ReactNode;
        domain: string;
        renderActions?: (message: SqueezedMessage, queryId?: string) => ReactNode;
        children?: ReactNode;
        darkCodeEnabled?: boolean;
        useConversationId: () => {
            conversationId: string;
            setConversationId: (conversationId: string) => void;
            resetConversationId: () => void;
        };
        openSearchPanel?: () => void;
        lang: string;
    }
>(
    (
        {
            children,
            body,
            headers,
            initialInput,
            setInitialInput,
            onSelectHit,
            prefetch,
            composerActions,
            domain,
            renderActions,
            asChild,
            darkCodeEnabled,
            useConversationId,
            openSearchPanel,
            lang,
            ...props
        },
        forwardedRef
    ) => {
        const ref = useRef<HTMLDivElement>(null);
        const { filters, handlePopState: handlePopFilters } = useFacetFilters();

        return (
            <DesktopCommandRoot
                label={t(lang).search.search}
                {...props}
                ref={composeRefs(forwardedRef, ref)}
                shouldFilter={true}
                disableAutoSelection={false}
                onPopState={composeEventHandlers(props.onPopState, handlePopFilters, {
                    checkForDefaultPrevented: false
                })}
                onEscapeKeyDown={props.onEscapeKeyDown}
                escapeKeyShouldPopState={filters.length > 0}
                data-fern-search="desktop-command"
                data-location="modal"
                data-mode={"search"}
                lang={lang}
            >
                <DesktopCommandContent asChild={asChild} lang={lang}>
                    <CommandAskAIGroup
                        onAskAI={(initialInput) => {
                            setInitialInput?.(initialInput);
                            openSearchPanel?.();
                            props.onEscapeKeyDown?.({} as any);
                        }}
                        forceMount
                        lang={lang}
                    />
                    {children}
                </DesktopCommandContent>
            </DesktopCommandRoot>
        );
    }
);

DesktopCommandWithAskAI.displayName = "DesktopCommandWithAskAI";
