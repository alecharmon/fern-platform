"use client";

import { ComponentPropsWithoutRef, KeyboardEventHandler, ReactNode, forwardRef, useRef } from "react";

import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";

import { SqueezedMessage } from "../chatbot/utils";
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
            ...props
        },
        forwardedRef
    ) => {
        const ref = useRef<HTMLDivElement>(null);
        const { filters, handlePopState: handlePopFilters } = useFacetFilters();

        return (
            <DesktopCommandRoot
                label={"Search"}
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
                data-mode={"search"}
            >
                <DesktopCommandContent asChild={asChild}>
                    <CommandAskAIGroup
                        onAskAI={(initialInput) => {
                            setInitialInput?.(initialInput);
                            openSearchPanel?.();
                            props.onEscapeKeyDown?.({} as any);
                        }}
                        forceMount
                    />
                    {children}
                </DesktopCommandContent>
            </DesktopCommandRoot>
        );
    }
);

DesktopCommandWithAskAI.displayName = "DesktopCommandWithAskAI";
