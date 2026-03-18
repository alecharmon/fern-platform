import type { MermaidConfig } from "mermaid";
import { type ReactElement, useEffect, useId, useRef, useState } from "react";

import { useResolvedTheme } from "@/docs/hooks/use-theme";
import { loadMermaid } from "./loadMermaid";

function getMermaidConfig(theme: string): MermaidConfig {
    if (theme === "dark") {
        return {
            securityLevel: "strict",
            theme: "base",
            themeVariables: {
                background: "transparent",
                primaryColor: "#1e293b",
                primaryTextColor: "#f1f5f9",
                primaryBorderColor: "#475569",
                lineColor: "#94a3b8",
                secondaryColor: "#334155",
                tertiaryColor: "#1e293b",
                textColor: "#f1f5f9",
                mainBkg: "#1e293b",
                nodeBorder: "#475569",
                clusterBkg: "#0f172a",
                clusterBorder: "#334155",
                titleColor: "#f1f5f9",
                edgeLabelBackground: "#1e293b",
                actorBkg: "#1e293b",
                actorBorder: "#475569",
                actorTextColor: "#f1f5f9",
                actorLineColor: "#94a3b8",
                signalColor: "#f1f5f9",
                signalTextColor: "#f1f5f9",
                labelBoxBkgColor: "#1e293b",
                labelBoxBorderColor: "#475569",
                labelTextColor: "#f1f5f9",
                loopTextColor: "#f1f5f9",
                noteBorderColor: "#475569",
                noteBkgColor: "#334155",
                noteTextColor: "#f1f5f9",
                activationBorderColor: "#475569",
                activationBkgColor: "#334155",
                sequenceNumberColor: "#f1f5f9",
                altBackground: "#0f172a",
                altBorderColor: "#334155",
                altSectionBkgColor: "#1e293b",
                sectionBkgColor: "#1e293b",
                sectionBkgColor2: "#0f172a"
            }
        };
    }
    return {
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
            background: "transparent",
            primaryColor: "#f8fafc",
            primaryTextColor: "#1e293b",
            primaryBorderColor: "#cbd5e1",
            lineColor: "#64748b",
            secondaryColor: "#e2e8f0",
            tertiaryColor: "#f1f5f9",
            textColor: "#1e293b",
            mainBkg: "#f8fafc",
            nodeBorder: "#cbd5e1",
            clusterBkg: "#f1f5f9",
            clusterBorder: "#e2e8f0",
            titleColor: "#1e293b",
            edgeLabelBackground: "#f8fafc",
            actorBkg: "#f8fafc",
            actorBorder: "#cbd5e1",
            actorTextColor: "#1e293b",
            actorLineColor: "#64748b",
            signalColor: "#1e293b",
            signalTextColor: "#1e293b",
            labelBoxBkgColor: "#f8fafc",
            labelBoxBorderColor: "#cbd5e1",
            labelTextColor: "#1e293b",
            loopTextColor: "#1e293b",
            noteBorderColor: "#cbd5e1",
            noteBkgColor: "#e2e8f0",
            noteTextColor: "#1e293b",
            activationBorderColor: "#cbd5e1",
            activationBkgColor: "#e2e8f0",
            sequenceNumberColor: "#1e293b"
        }
    };
}

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
                mermaid.initialize(getMermaidConfig(theme));
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
