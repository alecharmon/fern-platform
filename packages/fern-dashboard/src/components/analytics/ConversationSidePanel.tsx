import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { Sparkles, X } from "lucide-react";

import { FernFai } from "@fern-api/fai-sdk";
import { FootnoteSup } from "@fern-docs/search-ui/components/chatbot/footnote";
import { ChatbotTurnContextProvider } from "@fern-docs/search-ui/components/chatbot/turn-context";
import { MarkdownContent } from "@fern-docs/search-ui/components/md-content";

import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

interface ConversationSidePanelProps {
  conversation: FernFai.Conversation;
  onClose: () => void;
  isConversationLoading?: boolean;
}
export function ConversationSidePanel({
  conversation,
  onClose,
  isConversationLoading = false,
}: ConversationSidePanelProps) {
  const showLoading = isConversationLoading || conversation.turns.length === 0;
  return (
    <div className="flex w-full flex-col p-0 lg:max-w-lg lg:p-8">
      <div className="flex items-center justify-between pb-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center">
            <ChatBubbleLeftEllipsisIcon className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            {showLoading ? (
              <div className="flex h-12 w-full flex-col gap-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-5 w-28" />
              </div>
            ) : (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-lg font-semibold">Conversation</h2>
                <div className="text-sm text-gray-900">
                  {new Date(conversation.created_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
        <Button onClick={onClose} variant="ghost" size="iconSm">
          <X className="h-6 w-6" />
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {showLoading ? (
          <div className="flex w-full flex-col gap-3">
            <div className="relative ml-auto w-[70%]">
              <Skeleton className="h-6 w-full" />
            </div>
            <div className="flex items-start gap-4">
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="relative ml-auto w-[50%]">
              <Skeleton className="h-6 w-full" />
            </div>
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            {conversation.turns.map((message) => {
              return (
                <ChatbotTurnContextProvider key={message.created_at}>
                  <article>
                    {message.role === "USER" && (
                      <div className="relative mb-2 ml-auto w-fit max-w-[70%] whitespace-pre-wrap rounded-md bg-gray-300 px-5 py-2">
                        <section className="prose cursor-auto text-sm">
                          <MarkdownContent>{message.text}</MarkdownContent>
                        </section>
                      </div>
                    )}
                    <div className="flex items-start justify-start gap-4">
                      {message.role !== "USER" && (
                        <Sparkles className="my-1 size-4 shrink-0" />
                      )}
                      <section className="prose min-w-0 flex-1 shrink cursor-text text-sm [&_a]:break-words">
                        {message.role !== "USER" && (
                          <MarkdownContent
                            components={{
                              // ...components,
                              sup: FootnoteSup,
                              section: ({
                                children,
                                ...props
                              }: React.ComponentProps<"section">) => {
                                return <section {...props}>{children}</section>;
                              },
                            }}
                            plugins={["remarkGfm", "remarkTest"]}
                          >
                            {message.text}
                          </MarkdownContent>
                        )}
                      </section>
                    </div>
                  </article>
                </ChatbotTurnContextProvider>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
