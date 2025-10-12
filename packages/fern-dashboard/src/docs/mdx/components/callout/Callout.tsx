import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { cn } from "@fern-docs/components/cn";
import { FaIcon } from "@fern-docs/components/fa-icon";
import { Bell, Check, CheckCircle, Info, Pin, Rocket, Star, TriangleAlert } from "lucide-react";
import { type FC, isValidElement, type PropsWithChildren, type ReactElement, useRef } from "react";
import { SelectControl, TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";

export const EMPTY_CALLOUT_CONTENT = `
<Callout intent="info">
  Content
</Callout>
`;

type Intent = "info" | "warning" | "success" | "error" | "note" | "launch" | "tip" | "check";

export declare namespace Callout {
    export interface Props {
        intent: string;
        title?: string;
        icon?: unknown;
    }
}

function parseIntent(unknownIntent: unknown): Intent {
    if (typeof unknownIntent !== "string") {
        return "info";
    }

    return unknownIntent.trim().toLowerCase() as Intent;
}

export const Callout: FC<PropsWithChildren<Callout.Props>> = ({ intent: intentRaw, title, children, icon }) => {
    const intent = parseIntent(intentRaw);
    const { isWithinEditor } = useEditorComponent();

    const calloutRef = useRef<HTMLDivElement>(null);

    const calloutContent = (
        <div ref={calloutRef} data-intent={intent} className="fern-callout relative">
            {isWithinEditor && <EditorComponentPopoverButton className="absolute right-2 top-2" />}
            <div className="flex items-start space-x-4">
                <div className="[&_svg]:size-icon-md mt-0.5 w-4">
                    {typeof icon === "string" ? (
                        <FaIcon icon={icon} />
                    ) : isValidElement(icon) ? (
                        icon
                    ) : (
                        visitDiscriminatedUnion({ intent }, "intent")._visit({
                            info: () => <Info />,
                            warning: () => <Bell />,
                            success: () => <CheckCircle />,
                            error: () => <TriangleAlert />,
                            note: () => <Pin />,
                            launch: () => <Rocket />,
                            tip: () => <Star />,
                            check: () => <Check />,
                            _other: () => <Info />
                        })
                    )}
                </div>

                <div
                    className={cn(
                        "-my-4 flex-1 overflow-x-auto text-sm before:mb-4 before:block after:mt-4 after:block", // ::after margin ensures that bottom padding overlaps with botttom margins of internal content
                        isWithinEditor && "solid-hover-handle overflow-visible"
                    )}
                >
                    <h5 className={cn("leading-snug", isWithinEditor && "mb-2")}>{title}</h5>

                    {isWithinEditor ? <div className="-ml-8 -mt-4">{children}</div> : children}
                </div>
            </div>
        </div>
    );

    if (isWithinEditor) {
        return (
            <EditorComponentPopoverProvider
                attributes={{
                    title: new TextInputControl({ defaultValue: title }),
                    intent: new SelectControl({
                        options: ["info", "warning", "success", "error", "note", "launch", "tip", "check"],
                        defaultValue: intent
                    })
                }}
                targetRef={calloutRef}
            >
                {calloutContent}
            </EditorComponentPopoverProvider>
        );
    }

    return calloutContent;
};

// aliases

export function InfoCallout({
    children,
    ...props
}: PropsWithChildren<Omit<Callout.Props, "intent">>): ReactElement<any> {
    return (
        <Callout intent="info" {...props}>
            {children}
        </Callout>
    );
}

export function WarningCallout({
    children,
    ...props
}: PropsWithChildren<Omit<Callout.Props, "intent">>): ReactElement<any> {
    return (
        <Callout intent="warning" {...props}>
            {children}
        </Callout>
    );
}

export function SuccessCallout({
    children,
    ...props
}: PropsWithChildren<Omit<Callout.Props, "intent">>): ReactElement<any> {
    return (
        <Callout intent="success" {...props}>
            {children}
        </Callout>
    );
}

export function ErrorCallout({
    children,
    ...props
}: PropsWithChildren<Omit<Callout.Props, "intent">>): ReactElement<any> {
    return (
        <Callout intent="error" {...props}>
            {children}
        </Callout>
    );
}

export function NoteCallout({
    children,
    ...props
}: PropsWithChildren<Omit<Callout.Props, "intent">>): ReactElement<any> {
    return (
        <Callout intent="note" {...props}>
            {children}
        </Callout>
    );
}

export function LaunchNoteCallout({
    children,
    ...props
}: PropsWithChildren<Omit<Callout.Props, "intent">>): ReactElement<any> {
    return (
        <Callout intent="launch" {...props}>
            {children}
        </Callout>
    );
}

export function TipCallout({
    children,
    ...props
}: PropsWithChildren<Omit<Callout.Props, "intent">>): ReactElement<any> {
    return (
        <Callout intent="tip" {...props}>
            {children}
        </Callout>
    );
}

export function CheckCallout({
    children,
    ...props
}: PropsWithChildren<Omit<Callout.Props, "intent">>): ReactElement<any> {
    return (
        <Callout intent="check" {...props}>
            {children}
        </Callout>
    );
}
