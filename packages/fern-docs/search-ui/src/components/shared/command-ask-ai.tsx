import { t } from "@fern-docs/i18n";

import { Sparkles } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import * as Command from "../cmdk";
import { useSearchBox } from "../search/useSearchBox";

export const CommandAskAIGroup = forwardRef<
    HTMLDivElement,
    { onAskAI: (initialInput: string) => void; lang: string } & ComponentPropsWithoutRef<typeof Command.Group>
>(({ onAskAI, lang, ...props }, ref) => {
    const { query } = useSearchBox();
    const wordCount = query
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
    const shouldDisableAutoSelection = wordCount < 5;

    return (
        <Command.Group ref={ref} {...props}>
            <Command.Item
                onSelect={() => onAskAI(query.trim())}
                data-disable-auto-selection={shouldDisableAutoSelection}
            >
                <Sparkles />
                <AskAIText query={query.trim().length > 0 ? query.trim() : ""} lang={lang} />
            </Command.Item>
        </Command.Group>
    );
});

CommandAskAIGroup.displayName = "CommandAskAIGroup";

export const AskAIText = forwardRef<HTMLSpanElement, { query: string; lang: string }>(({ query, lang }, ref) => {
    return (
        <span ref={ref} className="inline-flex items-baseline overflow-hidden whitespace-nowrap">
            {t(lang).search.askAI}
            {query.trimStart().length > 0 && (
                <>
                    <span className="ms-1">&ldquo;</span>
                    <span className="min-w-0 shrink overflow-hidden text-ellipsis font-semibold">{query}</span>
                    <span>&rdquo;</span>
                </>
            )}
        </span>
    );
});

AskAIText.displayName = "AskAIText";
