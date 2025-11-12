import { CodeBlock } from "./CodeBlock";
import { CodeGroup } from "./CodeGroup";

/**
 * @deprecated Use `CodeGroup` instead.
 */
export function CodeBlocks({
    items,
    lang = "en"
}: {
    items: React.ComponentPropsWithoutRef<typeof CodeBlock>[];
    lang?: string;
}) {
    return (
        <CodeGroup lang={lang}>
            {items.map((item) => (
                <CodeBlock key={item.title} {...item} />
            ))}
        </CodeGroup>
    );
}
