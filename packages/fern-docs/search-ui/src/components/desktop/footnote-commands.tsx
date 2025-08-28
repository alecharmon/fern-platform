import { useAtomValue } from "jotai";

import { Badge } from "@fern-docs/components";

import { useChatbotTurnContext } from "../chatbot/turn-context";
import { CommandLink } from "../shared/command-link";

export function FootnoteCommands({
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
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="text-sm font-semibold">{footnote.title}</div>
            <div className="text-(color:--grayscale-12) min-w-0 truncate text-xs">
              {footnote.url}
            </div>
          </div>
        </CommandLink>
      ))}
    </>
  );
}
