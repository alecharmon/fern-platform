import {
    CodeBlockWithClipboardButton,
    FernSyntaxHighlighter,
    type FernSyntaxHighlighterProps
} from "@fern-docs/components/syntax-highlighter";
import type { FC } from "react";

interface CodeBlockProps extends FernSyntaxHighlighterProps {
    lang?: string;
}

export const CodeBlock: FC<CodeBlockProps> = ({ className, lang, ...props }) => (
    <CodeBlockWithClipboardButton code={props.code} className={className} lang={lang ?? "en"}>
        <FernSyntaxHighlighter {...props} />
    </CodeBlockWithClipboardButton>
);
