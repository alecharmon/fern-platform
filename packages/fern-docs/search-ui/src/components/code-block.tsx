import {
    CodeBlockWithClipboardButton,
    FernSyntaxHighlighter,
    type FernSyntaxHighlighterProps
} from "@fern-docs/components/syntax-highlighter";
import type { FC } from "react";

export const CodeBlock: FC<FernSyntaxHighlighterProps> = ({ className, ...props }) => (
    <CodeBlockWithClipboardButton code={props.code} className={className} lang={props.lang ?? "en"}>
        <FernSyntaxHighlighter {...props} />
    </CodeBlockWithClipboardButton>
);
