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
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Components } from "react-markdown";

import { UIMessage, useChat } from "@ai-sdk/react";
import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { TooltipPortal, TooltipProvider } from "@radix-ui/react-tooltip";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { DefaultChatTransport } from "ai";
import type { Element as HastElement } from "hast";
import { useAtomValue } from "jotai";
import {
  ArrowLeft,
  ArrowUp,
  CircleAlert,
  RotateCcw,
  Sparkles,
  SquarePen,
  StopCircle,
} from "lucide-react";
import { useIsomorphicLayoutEffect } from "swr/_internal";

import { FernTooltip, cn } from "@fern-docs/components";
import { Badge } from "@fern-docs/components/badges";
import { Button } from "@fern-docs/components/button";
import { FacetFilter } from "@fern-docs/search-keyword";
import { tunnel, useEventCallback, useIsMobile } from "@fern-ui/react-commons";

import { MAX_AI_CHAT_MESSAGE_LENGTH } from "../../constants";
import { FootnoteSup, FootnotesSection } from "../chatbot/footnote";
import {
  ChatbotTurnContextProvider,
  useChatbotTurnContext,
} from "../chatbot/turn-context";
import {
  SqueezedMessage,
  combineSearchResults,
  ensureMessagePartsHaveNewLines,
  squeezeMessages,
} from "../chatbot/utils";
import * as Command from "../cmdk";
import { CodeBlock } from "../code-block";
import { MarkdownContent } from "../md-content";
import { useFacetFilters } from "../search/useFacetFilters";
import { CommandAskAIGroup } from "../shared";
import { CommandLink } from "../shared/command-link";
import { TextArea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { DesktopCommandContent, afterInput } from "./desktop-command";
import { DesktopCommandInput } from "./desktop-command-input";
import { DesktopCommandRoot } from "./desktop-command-root";
import { Suggestions } from "./suggestions";

type PropsWithElement<T> = T & { node: HastElement };

const headerActions = tunnel();

export const DesktopCommandWithAskAI = forwardRef<
  HTMLDivElement,
  Omit<ComponentPropsWithoutRef<typeof DesktopCommandRoot>, "children"> & {
    askAI?: boolean;
    defaultAskAI?: boolean;
    setAskAI?: (askAI: boolean) => void;
    api?: string;
    suggestionsApi?: string;
    body?: object;
    headers?: Record<string, string>;
    initialInput?: string;
    chatId?: string;
    onSelectHit?: (path: string) => void;
    prefetch?: (path: string) => Promise<void>;
    composerActions?: ReactNode;
    domain: string;
    renderActions?: (message: SqueezedMessage) => ReactNode;
    setInitialInput?: (initialInput: string) => void;
    children?: ReactNode;
    darkCodeEnabled?: boolean;
    useConversationId: () => {
      conversationId: string;
      setConversationId: (conversationId: string) => void;
      resetConversationId: () => void;
    };
  }
>(
  (
    {
      children,
      api,
      suggestionsApi,
      body,
      headers,
      askAI: askAIProp,
      setAskAI: setAskAIProp,
      defaultAskAI,
      initialInput,
      chatId,
      onSelectHit,
      prefetch,
      composerActions,
      domain,
      renderActions,
      setInitialInput,
      asChild,
      darkCodeEnabled,
      useConversationId,
      ...props
    },
    forwardedRef
  ) => {
    const isMobile = useIsMobile();
    const ref = useRef<HTMLDivElement>(null);

    const [askAI, setAskAI] = useControllableState<boolean>({
      defaultProp: defaultAskAI,
      prop: askAIProp,
      onChange: setAskAIProp,
    });
    const { filters, handlePopState: handlePopFilters } = useFacetFilters();

    function glow() {
      if (ref.current) {
        const prefix = isMobile ? "inset " : "";
        ref.current.animate(
          {
            boxShadow: [
              `${prefix}0 0 0px var(--accent-a5), var(--cmdk-shadow)`,
              `${prefix}0 0 75px var(--accent-a5), var(--cmdk-shadow)`,
              `${prefix}0 0 150px transparent, var(--cmdk-shadow)`,
            ],
          },
          { duration: 800, easing: "ease-out" }
        );
      }
    }

    // animate on presence
    useEffect(() => {
      if (ref.current) {
        ref.current.animate(
          { transform: ["scale(0.96)", "scale(1)"] },
          { duration: 100, easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }
        );

        if (askAI) {
          glow();
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // bounce on action
    function bounce() {
      if (ref.current && !isMobile) {
        ref.current.animate(
          { transform: ["scale(1)", "scale(0.96)", "scale(1)"] },
          { duration: 200, easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }
        );
      }
    }

    return (
      <DesktopCommandRoot
        label={askAI ? "Ask AI" : "Search"}
        {...props}
        ref={composeRefs(forwardedRef, ref)}
        shouldFilter={!askAI}
        disableAutoSelection={askAI}
        onPopState={
          askAI
            ? props.onPopState
            : composeEventHandlers(props.onPopState, handlePopFilters, {
                checkForDefaultPrevented: false,
              })
        }
        onEscapeKeyDown={props.onEscapeKeyDown}
        escapeKeyShouldPopState={!askAI && filters.length > 0}
        data-mode={askAI ? "ask-ai" : "search"}
      >
        {askAI ? (
          <DesktopAskAIContent
            useConversationId={useConversationId}
            api={api}
            suggestionsApi={suggestionsApi}
            body={body}
            headers={headers}
            filters={filters}
            onReturnToSearch={() => {
              setAskAI(false);
              bounce();
            }}
            initialInput={initialInput}
            setInitialInput={setInitialInput}
            chatId={chatId}
            onSelectHit={onSelectHit}
            prefetch={prefetch}
            composerActions={composerActions}
            domain={domain}
            renderActions={renderActions}
            darkCodeEnabled={darkCodeEnabled}
          />
        ) : (
          <DesktopCommandContent asChild={asChild}>
            <CommandAskAIGroup
              onAskAI={(initialInput) => {
                setInitialInput?.(initialInput);
                setAskAI(true);
                bounce();
                glow();
              }}
              forceMount
            />
            {children}
          </DesktopCommandContent>
        )}
      </DesktopCommandRoot>
    );
  }
);

DesktopCommandWithAskAI.displayName = "DesktopCommandWithAskAI";

const DesktopAskAIContent = (props: {
  onReturnToSearch?: () => void;
  initialInput?: string;
  setInitialInput?: (initialInput: string) => void;
  chatId?: string;
  useConversationId: () => {
    conversationId: string;
    setConversationId: (conversationId: string) => void;
    resetConversationId: () => void;
  };
  api?: string;
  suggestionsApi?: string;
  body?: object;
  filters?: readonly FacetFilter[];
  headers?: Record<string, string>;
  onSelectHit?: (path: string) => void;
  prefetch?: (path: string) => Promise<void>;
  composerActions?: ReactNode;
  domain: string;
  renderActions?: (message: SqueezedMessage) => ReactNode;
  darkCodeEnabled?: boolean;
}) => {
  return (
    <>
      <div className="flex items-center justify-between p-2 pb-0">
        <div>
          {props.onReturnToSearch && (
            <Button
              size="xs"
              variant="outline"
              onClick={props.onReturnToSearch}
            >
              <ArrowLeft />
              Back to search
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <headerActions.Out />
          <afterInput.Out />
        </div>
      </div>
      <DesktopAskAIChat {...props} />
    </>
  );
};

const DesktopAskAIChat = ({
  onReturnToSearch,
  initialInput,
  setInitialInput,
  chatId,
  useConversationId,
  api,
  suggestionsApi,
  body,
  headers,
  filters,
  onSelectHit,
  prefetch,
  composerActions,
  domain,
  renderActions,
  darkCodeEnabled,
}: {
  onReturnToSearch?: () => void;
  initialInput?: string;
  setInitialInput?: (initialInput: string) => void;
  chatId?: string;
  useConversationId: () => {
    conversationId: string;
    setConversationId: (conversationId: string) => void;
    resetConversationId: () => void;
  };
  api?: string;
  suggestionsApi?: string;
  body?: object;
  filters?: readonly FacetFilter[];
  headers?: Record<string, string>;
  onSelectHit?: (path: string) => void;
  prefetch?: (path: string) => Promise<void>;
  composerActions?: ReactNode;
  domain: string;
  renderActions?: (message: SqueezedMessage) => ReactNode;
  darkCodeEnabled?: boolean;
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [initialInputSent, setInitialInputSent] = useState(false);
  const { conversationId, resetConversationId } = useConversationId();
  const chat = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: api || "/api/chat",
      credentials: "include",
      headers: headers,
      body: {
        ...body,
        url: document.location.href,
        filters,
        conversationId: conversationId,
      },
    }),
  });

  // Reset userScrolled when the chat is loading
  useIsomorphicLayoutEffect(() => {
    if (chat.status !== "ready") {
      setUserScrolled(false);
    }
  }, [chat.status === "streaming"]);

  const [input, setInput] = useState("");

  const askAI = (message?: string): void => {
    // message is set when clicking suggestions
    // otherwise we use internal state (input, setInput)
    void chat.sendMessage({
      role: "user",
      parts: [{ type: "text", text: message ?? input }],
    });
    setInput("");
  };

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
    askAI(initialInput);
    setInitialInputSent(true);
    setInitialInput?.("");
  }

  const [isScrolled, setIsScrolled] = useState(false);

  return (
    <>
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
        <headerActions.In>
          {
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="iconXs"
                    variant="outline"
                    onClick={() => {
                      void chat.stop();
                      chat.setMessages([]);
                      chat.error = undefined;
                      resetConversationId();
                    }}
                  >
                    <SquarePen />
                  </Button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent>
                    <p>New chat</p>
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </TooltipProvider>
          }
        </headerActions.In>

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
        }}
        onSend={askAI}
        onKeyDown={useEventCallback((e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            setUserScrolled(true);
          }
        })}
        onPopState={onReturnToSearch}
        actions={composerActions}
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
    actions?: ReactNode;
  }
>(
  (
    { error, onError, isLoading, stop, onSend, onPopState, actions, ...props },
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
      <div
        className="border-border-default cursor-text border-t p-2"
        onClick={() => inputRef.current?.focus()}
      >
        <DesktopCommandInput asChild>
          <TextArea
            ref={composeRefs(forwardedRef, inputRef)}
            autoFocus
            placeholder="Ask AI a question..."
            minLines={1}
            lineHeight={24}
            maxLines={10}
            padding={8}
            {...props}
            className={cn(
              "block w-full resize-none p-2 focus:outline-none",
              props.className
            )}
            style={{
              fontSize: "16px",
              lineHeight: "24px",
              maxHeight: 200,
              ...props.style,
            }}
            onKeyDown={composeEventHandlers(
              props.onKeyDown,
              (e) => {
                if (e.key === "Enter") {
                  if (value.length === 0) {
                    return;
                  } else if (isLoading) {
                    stop?.();
                    e.preventDefault();
                  } else {
                    if (!e.shiftKey && canSubmit) {
                      onSend?.(value);
                      e.preventDefault();
                    }
                  }

                  e.stopPropagation();
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
        <div className="flex items-center justify-between">
          <div>{actions}</div>
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
            <span className="pointer-events-auto cursor-pointer">
              <Button
                size="icon"
                className="rounded-full"
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
                disabled={!isLoading && !canSubmit}
              >
                {error ? (
                  <CircleAlert />
                ) : isLoading ? (
                  <StopCircle />
                ) : (
                  <ArrowUp />
                )}
              </Button>
            </span>
          </FernTooltip>
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
  renderActions?: (message: SqueezedMessage) => ReactNode;
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
            <Sparkles className="my-1 size-4 shrink-0" />
            <div className="space-y-2">
              <p>
                Hi, I&apos;m an AI assistant with access to documentation and
                other content.
              </p>
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
                      <Sparkles className="my-1 size-4 shrink-0" />
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
                          renderActions?.(message)}
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

function FootnoteCommands({
  onSelect,
  prefetch,
  domain,
}: {
  onSelect?: (path: string) => void;
  prefetch?: (path: string) => Promise<void>;
  domain: string;
}) {
  const { footnotesAtom } = useChatbotTurnContext();
  const footnotes = useAtomValue(footnotesAtom);
  return (
    <>
      {footnotes.map((footnote, idx) => (
        <CommandLink
          key={footnote.ids.join("-")}
          href={footnote.url}
          onSelect={onSelect}
          prefetch={prefetch}
          domain={domain}
        >
          <Badge color="gray" variant="subtleSolidHover">
            {String(idx + 1)}
          </Badge>
          <div>
            <div className="text-sm font-semibold">{footnote.title}</div>
            <div className="text-(color:--grayscale-12) text-xs">
              {footnote.url}
            </div>
          </div>
        </CommandLink>
      ))}
    </>
  );
}

function HideHeadersInUserMessage() {
  return {
    h1: ({ children }: PropsWithElement<React.ComponentProps<"h1">>) =>
      children,
    h2: ({ children }: PropsWithElement<React.ComponentProps<"h2">>) =>
      children,
    h3: ({ children }: PropsWithElement<React.ComponentProps<"h3">>) =>
      children,
    h4: ({ children }: PropsWithElement<React.ComponentProps<"h4">>) =>
      children,
    h5: ({ children }: PropsWithElement<React.ComponentProps<"h5">>) =>
      children,
    h6: ({ children }: PropsWithElement<React.ComponentProps<"h6">>) =>
      children,
  };
}
