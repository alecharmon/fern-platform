import { useRef } from "react";
import { TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";
import { useFileResolver } from "@/providers/FileResolverContext";

export const EMPTY_EMBED_CONTENT = `
<embed src="" />
`;

export declare namespace Embed {
    export interface Props {
        src?: string;
        width?: number;
        height?: number;
        title?: string;
        type?: string;
    }
}

export function Embed({ src, type, ...props }: Embed.Props) {
    const { isWithinEditor } = useEditorComponent();
    const { resolveFileSrc } = useFileResolver();
    const embedRef = useRef<HTMLDivElement>(null);

    const resolvedSrc = resolveFileSrc(src);

    const embedContent = (
        <div ref={embedRef} className="relative w-full">
            {isWithinEditor && (
                <EditorComponentPopoverButton className="absolute -right-[38px] z-10" componentName="Embed" />
            )}

            {!src || src.trim() === "" ? (
                // Placeholder when no src is provided
                <div className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-500 p-14" />
            ) : (
                // Render embed when src is provided
                <embed src={resolvedSrc?.src || src} type={type} {...props} />
            )}
        </div>
    );

    if (isWithinEditor) {
        return (
            <EditorComponentPopoverProvider
                attributes={{
                    src: new TextInputControl({
                        placeholder: "Enter embed URL",
                        defaultValue: src
                    }),
                    type: new TextInputControl({
                        placeholder: "MIME type (optional)",
                        defaultValue: type
                    })
                }}
                targetRef={embedRef}
                hoverSlopThreshold={42}
            >
                {embedContent}
            </EditorComponentPopoverProvider>
        );
    }

    return embedContent;
}
