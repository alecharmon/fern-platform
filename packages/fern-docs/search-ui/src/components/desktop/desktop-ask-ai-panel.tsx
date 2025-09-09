"use client";

import {
  ComponentPropsWithoutRef,
  KeyboardEventHandler,
  ReactElement,
  ReactNode,
  createElement,
  forwardRef,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import React from "react";
import { Components } from "react-markdown";

import { UIMessage, useChat } from "@ai-sdk/react";
import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { DefaultChatTransport } from "ai";
import type { Element as HastElement } from "hast";
import {
  ArrowUp,
  CircleAlert,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";
import { useIsomorphicLayoutEffect } from "swr/_internal";

import { isNonNullish } from "@fern-api/ui-core-utils";
import { FernButton, FernTooltip, cn } from "@fern-docs/components";
import { Button } from "@fern-docs/components/button";
import {
  FERN_ASK_AI_PANEL_HEADER_ICON_ID,
  FERN_ASK_AI_PANEL_HEADER_ID,
  FERN_ASK_AI_PANEL_INPUT_ID,
} from "@fern-docs/components/constants";
import { FacetFilter } from "@fern-docs/search-keyword";
import { useEventCallback } from "@fern-ui/react-commons";

import { MAX_AI_CHAT_MESSAGE_LENGTH } from "../../constants";
import { isQueryIdPart } from "../../utils/query-id-part";
import { AskAiContextPill } from "../ask-ai-context-pill";
import { FootnoteSup, FootnotesSection } from "../chatbot/footnote";
import { ChatbotTurnContextProvider } from "../chatbot/turn-context";
import {
  SqueezedMessage,
  combineSearchResults,
  ensureMessagePartsHaveNewLines,
  squeezeMessages,
} from "../chatbot/utils";
import * as Command from "../cmdk";
import { CodeBlock } from "../code-block";
import { CircleStopIcon as StopCircle } from "../icons/circle-stop";
import { CommandKbd, ForwardSlashKbd } from "../icons/kbd";
import { SparklesIcon, SparklesIconHollow } from "../icons/sparkles";
import { MarkdownContent } from "../md-content";
import { useFacetFilters } from "../search/useFacetFilters";
import { TextArea } from "../ui/textarea";
import { DesktopCommandInput } from "./desktop-command-input";
import { DesktopCommandRoot } from "./desktop-command-root";
import { FilterDropdownMenu, FilterManager } from "./filter-components";
import { FootnoteCommands } from "./footnote-commands";
import { HideHeadersInUserMessage } from "./hide-headers-in-user-messages";
import { Suggestions } from "./suggestions";

type PropsWithElement<T> = T & { node: HastElement };

export const DesktopAskAiPanel = forwardRef<
  HTMLDivElement,
  Omit<ComponentPropsWithoutRef<typeof DesktopCommandRoot>, "children"> & {
    api?: string;
    suggestionsApi?: string;
    body?: object;
    headers?: Record<string, string>;
    chatId?: string;
    onSelectHit?: (path: string) => void;
    prefetch?: (path: string) => Promise<void>;
    domain: string;
    renderActions?: (message: SqueezedMessage, queryId?: string) => ReactNode;
    initialInput?: string;
    setInitialInput?: (initialInput: string) => void;
    children?: ReactNode;
    darkCodeEnabled?: boolean;
    useConversationId: () => {
      conversationId: string;
      setConversationId: (conversationId: string) => void;
      resetConversationId: () => void;
    };
    useQueryId: () => {
      queryId: string;
      setQueryId: (queryId: string) => void;
      resetQueryId: () => void;
    };
    onClose?: () => void;
    pageContext?: { title: string; url: string } | null;
    onRemovePageContext?: () => void;
    searchDialogOpen: boolean;
    panelWidth: number;
  }
>(
  (
    {
      children,
      api,
      suggestionsApi,
      body,
      headers,
      chatId,
      onSelectHit,
      prefetch,
      domain,
      renderActions,
      initialInput,
      setInitialInput,
      asChild,
      darkCodeEnabled,
      useConversationId,
      useQueryId,
      onClose,
      pageContext,
      onRemovePageContext,
      searchDialogOpen,
      panelWidth,
      ...props
    },
    forwardedRef
  ) => {
    const ref = useRef<HTMLDivElement>(null);
    const { filters } = useFacetFilters();

    return (
      <DesktopCommandRoot
        label={"Ask AI"}
        {...props}
        ref={composeRefs(forwardedRef, ref)}
        shouldFilter={false}
        disableAutoSelection={true}
        onPopState={undefined}
        onEscapeKeyDown={undefined}
        escapeKeyShouldPopState={false}
        data-fern-search="desktop-command"
        data-mode={"ask-ai"}
      >
        <DesktopAskAIContent
          useConversationId={useConversationId}
          useQueryId={useQueryId}
          api={api}
          suggestionsApi={suggestionsApi}
          body={body}
          headers={headers}
          filters={filters}
          initialInput={initialInput}
          setInitialInput={setInitialInput}
          chatId={chatId}
          onSelectHit={onSelectHit}
          prefetch={prefetch}
          domain={domain}
          renderActions={renderActions}
          darkCodeEnabled={darkCodeEnabled}
          onClose={onClose}
          pageContext={pageContext}
          onRemovePageContext={onRemovePageContext}
          searchDialogOpen={searchDialogOpen}
          panelWidth={panelWidth}
        />
      </DesktopCommandRoot>
    );
  }
);

DesktopAskAiPanel.displayName = "DesktopAskAiPanel";

const DesktopAskAIContent = (props: {
  initialInput?: string;
  setInitialInput?: (initialInput: string) => void;
  chatId?: string;
  useConversationId: () => {
    conversationId: string;
    setConversationId: (conversationId: string) => void;
    resetConversationId: () => void;
  };
  useQueryId: () => {
    queryId: string;
    setQueryId: (queryId: string) => void;
    resetQueryId: () => void;
  };
  api?: string;
  suggestionsApi?: string;
  body?: object;
  filters?: readonly FacetFilter[];
  headers?: Record<string, string>;
  onSelectHit?: (path: string) => void;
  prefetch?: (path: string) => Promise<void>;
  domain: string;
  renderActions?: (message: SqueezedMessage, queryId?: string) => ReactNode;
  darkCodeEnabled?: boolean;
  onClose?: () => void;
  pageContext?: { title: string; url: string } | null;
  onRemovePageContext?: () => void;
  searchDialogOpen: boolean;
  panelWidth: number;
}) => {
  return (
    <>
      <DesktopAskAIChat {...props} />
    </>
  );
};

const DesktopAskAIChat = ({
  initialInput,
  setInitialInput,
  chatId,
  useConversationId,
  useQueryId,
  api,
  suggestionsApi,
  body,
  headers,
  filters,
  onSelectHit,
  prefetch,
  domain,
  renderActions,
  darkCodeEnabled,
  onClose,
  pageContext,
  onRemovePageContext,
  searchDialogOpen,
  panelWidth,
}: {
  initialInput?: string;
  setInitialInput?: (initialInput: string) => void;
  chatId?: string;
  useConversationId: () => {
    conversationId: string;
    setConversationId: (conversationId: string) => void;
    resetConversationId: () => void;
  };
  useQueryId: () => {
    queryId: string;
    setQueryId: (queryId: string) => void;
    resetQueryId: () => void;
  };
  api?: string;
  suggestionsApi?: string;
  body?: object;
  headers?: Record<string, string>;
  filters?: readonly FacetFilter[];
  onSelectHit?: (path: string) => void;
  prefetch?: (path: string) => Promise<void>;
  domain: string;
  renderActions?: (message: SqueezedMessage, queryId?: string) => ReactNode;
  darkCodeEnabled?: boolean;
  onClose?: () => void;
  pageContext?: { title: string; url: string } | null;
  onRemovePageContext?: () => void;
  searchDialogOpen: boolean;
  panelWidth: number;
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [initialInputSent, setInitialInputSent] = useState(false);
  const { conversationId, resetConversationId } = useConversationId();
  const [showMaximizeOption, setShowMaximizeOption] = useState(true);
  const { queryId, setQueryId } = useQueryId();
  const [messageQueryIds, setMessageQueryIds] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!queryId) {
      setQueryId(crypto.randomUUID());
    }
  }, [queryId, setQueryId]);

  const defaultTransportBody = useMemo(() => {
    return {
      ...body,
      url: window.location.href,
      conversationId,
      queryId,
      filters,
    };
  }, [body, conversationId, queryId, filters, window.location.href]);

  const transport = new DefaultChatTransport({
    api: api || "/api/chat",
    credentials: "include",
    headers: headers,
    body: defaultTransportBody,
  });

  const chat = useChat({
    id: chatId,
    transport,
  });

  const toggleMaximize = () => {
    setShowMaximizeOption(!showMaximizeOption);
    window.dispatchEvent(
      new CustomEvent("search-panel:toggle-size", {
        detail: { isMaximized: showMaximizeOption },
      })
    );
  };

  useEffect(() => {
    if (window !== undefined) {
      const vw = window.innerWidth;
      if (panelWidth <= (0.4 * vw + Math.min(344, vw * 0.2)) / 2) {
        setShowMaximizeOption(true);
      } else {
        setShowMaximizeOption(false);
      }
    }
  }, [panelWidth]);

  useEffect(() => {
    if (!searchDialogOpen) {
      setInitialInputSent(false);
    }
  }, [searchDialogOpen]);

  useIsomorphicLayoutEffect(() => {
    if (chat.status !== "ready") {
      setUserScrolled(false);
    }
  }, [chat.status === "streaming"]);

  useEffect(() => {
    const lastMessage = chat.messages[chat.messages.length - 1];
    if (lastMessage?.role === "assistant" && chat.status === "ready") {
      if (messageQueryIds[lastMessage.id]) {
        return;
      }

      const queryIdPart = lastMessage.parts?.find((part) =>
        isQueryIdPart(part)
      );

      if (queryIdPart) {
        setMessageQueryIds((prev) => ({
          ...prev,
          [lastMessage.id]: queryIdPart.data,
        }));
      } else {
        const assistantQueryId = crypto.randomUUID();
        setMessageQueryIds((prev) => ({
          ...prev,
          [lastMessage.id]: assistantQueryId,
        }));
      }
    }
  }, [chat.messages, chat.status, messageQueryIds]);

  const [input, setInput] = useState("");

  const askAI = useCallback(
    (message?: string): void => {
      const newQueryId = crypto.randomUUID();
      setQueryId(newQueryId);

      void chat.sendMessage(
        {
          role: "user",
          parts: [{ type: "text", text: message ?? input }],
        },
        {
          body: {
            ...defaultTransportBody,
            queryId: newQueryId, // Use the new queryId for this specific message
            documentUrls: [pageContext?.url].filter(isNonNullish),
          },
        }
      );

      setInput("");
    },
    [chat, input, setInput, pageContext?.url, defaultTransportBody, setQueryId]
  );

  if (
    initialInput &&
    !initialInputSent &&
    !chat.messages
      .map((m) =>
        m.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("")
      )
      .includes(initialInput)
  ) {
    if (chat.status !== "ready") {
      setInput(initialInput);
    } else {
      askAI(initialInput);
    }
    setInitialInputSent(true);
    setInitialInput?.("");
  }

  const [isScrolled, setIsScrolled] = useState(false);

  return (
    <>
      <div
        id={FERN_ASK_AI_PANEL_HEADER_ID}
        className="border-border-default flex items-center justify-between border-b p-4"
      >
        <div className="flex items-center gap-2">
          <SparklesIcon
            id={FERN_ASK_AI_PANEL_HEADER_ICON_ID}
            fill="var(--accent)"
            className="h-[16.667px] w-[16.667px]"
          />
          <span
            style={{
              fontSize: "16px",
              fontStyle: "normal",
              fontWeight: "700",
              lineHeight: "24px",
            }}
          >
            Assistant
          </span>
        </div>
        <div className="flex items-center gap-1">
          <FernButton
            variant="minimal"
            size="normal"
            className="transition-all duration-200 ease-in-out hover:bg-gray-100 max-sm:hidden dark:hover:bg-gray-800 [&]:h-6 [&]:w-6 [&]:px-0 [&]:py-0 [&_.fern-button-content]:h-4 [&_.fern-button-content]:w-4"
            onClick={toggleMaximize}
            title={showMaximizeOption ? "Maximize" : "Minimize"}
          >
            {showMaximizeOption ? (
              <Maximize2 size={16} />
            ) : (
              <Minimize2 size={16} />
            )}
          </FernButton>

          <FernButton
            variant="minimal"
            size="normal"
            className="[&]:h-6 [&]:w-6 [&]:px-0 [&]:py-0 [&_.fern-button-content]:h-4 [&_.fern-button-content]:w-4"
            onClick={() => {
              void chat.stop();
              chat.setMessages([]);
              chat.error = undefined;
              resetConversationId();
              setQueryId(crypto.randomUUID());
            }}
          >
            <RotateCw size={16} />
          </FernButton>

          <FernButton
            variant="minimal"
            size="normal"
            className="[&]:h-6 [&]:w-6 [&]:px-0 [&]:py-0 [&_.fern-button-content]:h-4 [&_.fern-button-content]:w-4"
            onClick={onClose}
          >
            <X size={16} />
          </FernButton>
        </div>
      </div>
      <Command.List
        onWheel={(e) => {
          if (e.deltaY > 0) {
            setUserScrolled(true);
          }
        }}
        onTouchMove={(e) => {
          if (
            e.touches[0]?.clientY !== e.touches[e.touches.length - 1]?.clientY
          ) {
            setUserScrolled(true);
          }
        }}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop > 5) {
            setIsScrolled(true);
          } else {
            setIsScrolled(false);
          }
        }}
        tabIndex={-1}
        className={cn(isScrolled && "mask-grad-top-3")}
        data-disable-animation={chat.status !== "ready" ? "" : undefined}
      >
        <AskAICommandItems
          messages={chat.messages}
          error={chat.error}
          regenerate={() => void chat.regenerate()}
          onSelectHit={onSelectHit}
          prefetch={prefetch}
          components={useMemo(
            (): Components => ({
              pre({
                node,
                ...props
              }: PropsWithElement<React.ComponentProps<"pre">>) {
                if (
                  isValidElement(props.children) &&
                  props.children.type === "code"
                ) {
                  const { children, className } = props.children.props as {
                    children: string;
                    className: string;
                  };
                  if (typeof children === "string") {
                    const match =
                      /language-(\w+)/.exec(className || "")?.[1] ??
                      "plaintext";
                    return (
                      <CodeBlock
                        code={children}
                        language={match}
                        fontSize="sm"
                        className={cn({
                          "bg-card-solid dark": darkCodeEnabled,
                        })}
                      />
                    );
                  }
                }
                return <pre {...props} />;
              },

              a: ({
                children,
                node,
                ...props
              }: PropsWithElement<React.ComponentProps<"a">>) => (
                <a
                  {...props}
                  className="decoration-(color:--accent-a10) hover:text-(color:--accent-a10) font-semibold hover:decoration-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {children}
                </a>
              ),

              p: ({
                children,
                node,
                ...props
              }: PropsWithElement<React.ComponentProps<"p">>) => (
                <p {...props}>{children}</p>
              ),
            }),
            [darkCodeEnabled]
          )}
          isLoading={chat.status !== "ready"}
          userScrolled={userScrolled}
          domain={domain}
          renderActions={renderActions}
          messageQueryIds={messageQueryIds}
        >
          {suggestionsApi && (
            <Suggestions
              api={suggestionsApi}
              body={body}
              headers={headers}
              askAI={askAI}
            />
          )}
        </AskAICommandItems>
      </Command.List>
      <AskAiContextPill
        pageContext={pageContext}
        onRemove={onRemovePageContext}
        onSelectHit={onSelectHit}
      />
      <AskAIComposer
        ref={inputRef}
        value={input}
        onValueChange={setInput}
        isLoading={chat.status !== "ready"}
        stop={() => {
          void chat.stop();
        }}
        error={chat.error}
        onError={(e) => {
          console.error(e);
          void chat.stop();
          chat.setMessages([]);
          chat.error = undefined;
          resetConversationId();
          setQueryId(crypto.randomUUID());
        }}
        onSend={askAI}
        filters={filters}
        onKeyDown={useEventCallback((e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            setUserScrolled(true);
          }
        })}
      />
    </>
  );
};

const AskAIComposer = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<typeof TextArea> & {
    error?: Error;
    onError?: (e?: Error) => void;
    isLoading?: boolean;
    stop?: () => void;
    onSend?: (message: string) => void;
    onPopState?: KeyboardEventHandler<HTMLTextAreaElement>;
    filters?: readonly FacetFilter[];
  }
>(
  (
    {
      error,
      onError,
      isLoading,
      stop,
      onSend,
      onPopState,
      filters = [],
      ...props
    },
    forwardedRef
  ) => {
    const value = typeof props.value === "string" ? props.value : "";
    const isOverLimit = value.length > MAX_AI_CHAT_MESSAGE_LENGTH;
    const canSubmit =
      value
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length >= 1 && !isOverLimit;
    const inputRef = useRef<HTMLTextAreaElement>(null);
    return (
      <div className="relative p-4">
        <div
          className="relative cursor-text border border-b-0 pl-3 pt-3"
          onClick={() => inputRef.current?.focus()}
          style={{
            borderColor: "var(--color-border-default)",
            borderRadius: "16px 16px 0 0",
          }}
        >
          <DesktopCommandInput asChild>
            <TextArea
              id={FERN_ASK_AI_PANEL_INPUT_ID}
              ref={composeRefs(forwardedRef, inputRef)}
              autoFocus
              placeholder="Ask AI a question..."
              minLines={1}
              lineHeight={18}
              maxLines={8}
              padding={6}
              maxLength={MAX_AI_CHAT_MESSAGE_LENGTH}
              {...props}
              className={cn(
                "block w-full resize-none focus:outline-none",
                props.className
              )}
              style={{
                fontSize: "15px",
                lineHeight: "18px",
                maxHeight: "192px",
                border: "none",
                borderRadius: "0",
                padding: "0",
                paddingRight: "11px",
                backgroundColor: "transparent",
                ...props.style,
              }}
              onKeyDown={composeEventHandlers(
                props.onKeyDown,
                (e) => {
                  if (e.key === "Enter") {
                    if (value.length === 0) {
                      return;
                    } else if (isLoading) {
                    } else {
                      if (!e.shiftKey && canSubmit) {
                        onSend?.(value);
                        e.preventDefault();
                      }
                    }

                    // Only stop propagation if we actually handled the event
                    if (value.length > 0) {
                      e.stopPropagation();
                    }
                  } else if (
                    value.length > 0 &&
                    (e.key === "ArrowUp" || e.key === "ArrowDown")
                  ) {
                    e.stopPropagation();
                  } else if (
                    value.length === 0 &&
                    e.key === "Backspace" &&
                    (e.ctrlKey || e.metaKey)
                  ) {
                    onPopState?.(e);
                  }
                },
                { checkForDefaultPrevented: false }
              )}
            />
          </DesktopCommandInput>
        </div>

        <div
          className="pointer-events-none flex items-center justify-between border border-t-0 pb-3 pl-3 pr-3 pt-1"
          style={{
            borderColor: "var(--color-border-default)",
            borderRadius: "0 0 16px 16px",
          }}
        >
          <div className="pointer-events-auto flex min-w-0 flex-1 items-center">
            {filters.length === 0 ? (
              <FilterDropdownMenu filters={filters} />
            ) : (
              <FilterManager filters={filters} />
            )}
          </div>
          <div className="pointer-events-auto flex items-center gap-2 pt-0.5">
            <FernTooltip
              content={
                isOverLimit
                  ? `Message must be ${MAX_AI_CHAT_MESSAGE_LENGTH} characters or fewer`
                  : error
                    ? "An error occurred - click to reset the conversation."
                    : undefined
              }
              side="top"
            >
              <Button
                size="icon"
                className="h-[32px] w-[32px]"
                variant="default"
                onClick={
                  error
                    ? () => {
                        onError?.();
                        if (canSubmit) {
                          onSend?.(value);
                        }
                      }
                    : isLoading
                      ? () => stop?.()
                      : () => onSend?.(value)
                }
                style={{
                  borderRadius: "8px",
                }}
                disabled={!isLoading && !canSubmit}
              >
                {error ? (
                  <CircleAlert size={16} />
                ) : isLoading ? (
                  <StopCircle />
                ) : (
                  <ArrowUp size={16} />
                )}
              </Button>
            </FernTooltip>
          </div>
        </div>
      </div>
    );
  }
);

AskAIComposer.displayName = "AskAIComposer";

const AskAICommandItems = memo<{
  messages: UIMessage[];
  error?: Error;
  regenerate: () => void;
  onSelectHit?: (path: string) => void;
  components?: Components;
  isLoading?: boolean;
  userScrolled?: boolean;
  children?: ReactNode;
  prefetch?: (path: string) => Promise<void>;
  domain: string;
  renderActions?: (message: SqueezedMessage, queryId?: string) => ReactNode;
  messageQueryIds?: Record<string, string>;
}>(
  ({
    messages,
    error,
    regenerate,
    onSelectHit,
    components = {},
    userScrolled = true,
    isLoading,
    children,
    prefetch,
    domain,
    renderActions,
    messageQueryIds = {},
  }): ReactElement<any> => {
    const messagesWithNewLines = ensureMessagePartsHaveNewLines(messages);
    const squeezedMessages = squeezeMessages(messagesWithNewLines);

    const lastConversationRef = useRef<Element | null>(null);
    const lastConversationId =
      squeezedMessages[squeezedMessages.length - 1]?.assistant?.id ??
      squeezedMessages[squeezedMessages.length - 1]?.user?.id;
    useIsomorphicLayoutEffect(() => {
      if (
        lastConversationRef.current &&
        lastConversationRef.current.getAttribute("data-conversation-id") !==
          lastConversationId
      ) {
        lastConversationRef.current = null;
      }

      if (!lastConversationRef.current) {
        lastConversationRef.current = document.querySelector(
          `[data-conversation-id="${lastConversationId}"]`
        );
      }
    }, [lastConversationId]);

    useEffect(() => {
      if (lastConversationRef.current && isLoading && !userScrolled) {
        lastConversationRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    });

    if (squeezedMessages.length === 0) {
      return (
        <>
          <div className="flex gap-4 p-2">
            <div className="space-y-4">
              <p
                style={{
                  fontSize: "14px",
                }}
              >
                Hi, I&apos;m an AI assistant with access to documentation and
                other content.
              </p>
              <div
                style={{
                  fontSize: "14px",
                }}
                className="flex flex-row items-center gap-1"
              >
                <p>Tip: you can toggle this pane with</p>
                <CommandKbd className="" />
                <p>+</p>
                <ForwardSlashKbd className="" />
              </div>
            </div>
          </div>
          {children}
        </>
      );
    }

    return (
      <>
        {squeezedMessages.map((message, idx) => {
          const isLastMessage = idx === squeezedMessages.length - 1;
          const searchResults = combineSearchResults([message]);

          return (
            <ChatbotTurnContextProvider
              key={message.user?.id ?? message.assistant?.id ?? idx}
            >
              <Command.Group>
                <Command.Item
                  data-conversation-id={
                    message.assistant?.id ?? message.user?.id
                  }
                  value={message.assistant?.id ?? message.user?.id}
                  asChild
                  scrollLogicalPosition="start"
                >
                  <article>
                    <div className="bg-(color:--grayscale-a3) rounded-6 relative mb-2 ml-auto w-fit max-w-[70%] whitespace-pre-wrap px-5 py-2">
                      <section className="prose cursor-auto text-sm">
                        <MarkdownContent
                          components={{
                            ...components,
                            ...HideHeadersInUserMessage(),
                          }}
                        >
                          {message.user?.content ?? "_No user message_"}
                        </MarkdownContent>
                      </section>
                    </div>
                    <div className="flex items-start justify-start gap-4">
                      <SparklesIconHollow className="my-1 size-4 shrink-0" />
                      <section className="prose min-w-0 flex-1 shrink cursor-text text-sm">
                        {message.assistant?.content && (
                          <MarkdownContent
                            components={{
                              ...components,
                              sup: FootnoteSup,
                              section: ({
                                children,
                                node,
                                ...props
                              }: PropsWithElement<
                                React.ComponentProps<"section">
                              >) => {
                                if (node?.properties.dataFootnotes) {
                                  return (
                                    <FootnotesSection
                                      node={node}
                                      searchResults={searchResults}
                                      className="hidden"
                                    />
                                  );
                                }

                                if ("section" in components) {
                                  return createElement(
                                    components.section as React.ComponentType<
                                      PropsWithElement<
                                        React.ComponentProps<"section">
                                      >
                                    >,
                                    {
                                      ...props,
                                      node,
                                    },
                                    children
                                  );
                                }

                                return <section {...props}>{children}</section>;
                              },
                            }}
                            citations={message.assistant.citations ?? []}
                            plugins={["remarkGfm", "remarkTest"]}
                          >
                            {message.assistant.content}
                          </MarkdownContent>
                        )}
                        {isLastMessage && isLoading && (
                          <p className="text-(color:--grayscale-a10) thinking-dots">
                            Thinking
                          </p>
                        )}
                        {(!isLastMessage || !isLoading) &&
                          renderActions?.(
                            message,
                            messageQueryIds[message.assistant?.id || ""]
                          )}
                      </section>
                    </div>
                  </article>
                </Command.Item>
                <FootnoteCommands
                  onSelect={onSelectHit}
                  prefetch={prefetch}
                  domain={domain}
                />
              </Command.Group>
            </ChatbotTurnContextProvider>
          );
        })}
        {error && (
          <div className="flex flex-col items-center justify-center gap-2 p-2">
            <div className="flex items-center justify-center gap-2">
              <p className="text-(color:--red-a10)">An error occurred.</p>
              <Button variant="outline" onClick={() => regenerate()}>
                <RotateCcw />
                Retry
              </Button>
            </div>
            <p className="text-(color:--grayscale-a10) text-center text-sm">
              If this issue persists, please{" "}
              <a
                href="https://buildwithfern.com/learn#get-support"
                target="_blank"
                rel="noreferrer"
                className="hover:text-(color:--accent-a10) underline transition-colors"
              >
                contact us
              </a>
              .
            </p>
          </div>
        )}
      </>
    );
  }
);

AskAICommandItems.displayName = "AskAICommandItems";
