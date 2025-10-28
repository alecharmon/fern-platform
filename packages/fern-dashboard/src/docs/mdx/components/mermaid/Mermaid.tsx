import { type ReactElement, useEffect, useId, useRef, useState } from "react";

import { useResolvedTheme } from "@/docs/hooks/use-theme";
import { loadMermaid } from "./loadMermaid";

export function Mermaid({ children }: { children: string }): ReactElement<any> {
    if (typeof window === "undefined" || typeof children !== "string") {
        return <div />;
    }

    return <MermaidInternal code={children} />;
}

function MermaidInternal({ code }: { code: string }): ReactElement<any> {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>();
    const theme = useResolvedTheme();
    const id = useId();
    const mermaidId = `mermaid-${id.replace(/:/g, "-")}`;

    useEffect(() => {
        void (async () => {
            // TODO: if fail to load from jsdelivr, render an error message
            const mermaid = await loadMermaid();

            if (ref.current) {
                mermaid.initialize({
                    theme: theme === "dark" ? "dark" : "default"
                });
                const { svg: renderedSvg } = await mermaid.render(mermaidId, code);
                setSvg(renderedSvg);
            }
        })();
    }, [code, theme, mermaidId]);

    return (
        <div
            ref={ref}
            className="mermaid-container"
            dangerouslySetInnerHTML={svg != null ? { __html: svg } : undefined}
        />
    );
}
