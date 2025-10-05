import { type ReactElement, type ReactNode, useRef } from "react";

import { FernButton } from "@fern-docs/components/FernButton";
import { cn } from "@fern-docs/components/cn";
import { FernLinkButton } from "@fern-docs/components/FernLinkButton";

import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";
import { CheckboxControl, SelectControl, TextInputControl } from "@/components/editor/editor-component/controls";
import { DisableFernAnchor } from "@/docs/components/FernAnchor";

export const EMPTY_BUTTON_CONTENT = `
<Button text="Click me" intent="primary" />
`;

export declare namespace Button {
    export interface Props {
        className?: string;
        icon?: string | ReactNode;
        rightIcon?: string | ReactNode;
        minimal?: boolean;
        outlined?: boolean;
        mono?: boolean;
        full?: boolean;
        rounded?: boolean;
        active?: boolean;
        disabled?: boolean;
        small?: boolean;
        large?: boolean;
        intent?: "none" | "primary" | "success" | "warning" | "danger";
        text?: ReactNode;
        href?: string;
    }
}

export function Button({
    minimal,
    outlined,
    small,
    large,
    href,
    className,
    intent,
    ...props
}: Button.Props): ReactElement<any> {
    const { isWithinEditor } = useEditorComponent();
    const buttonRef = useRef<HTMLDivElement>(null);

    const variant = outlined ? "outlined" : minimal ? "minimal" : "filled";
    const size = small ? "small" : large ? "large" : "normal";

    // Intercept onClick when within editor
    const handleClick = (e: React.MouseEvent) => {
        if (isWithinEditor) {
            e.preventDefault();
            return;
        }
        if ("onClick" in props && typeof props.onClick === "function") {
            props.onClick(e);
        }
    };

    const buttonContent = (
        <div ref={buttonRef} className="relative inline-block">
            {isWithinEditor && <EditorComponentPopoverButton className="absolute -right-[38px] top-0" />}
            {href != null ? (
                <DisableFernAnchor>
                    <FernLinkButton
                        href={href}
                        scroll={true}
                        intent={intent}
                        {...props}
                        onClick={handleClick}
                        variant={variant}
                        size={size}
                        className={cn(className, "not-prose")}
                    />
                </DisableFernAnchor>
            ) : (
                <FernButton
                    {...props}
                    onClick={handleClick}
                    intent={intent}
                    variant={variant}
                    size={size}
                    className={cn(className, "not-prose")}
                />
            )}
        </div>
    );

    if (isWithinEditor) {
        return (
            <EditorComponentPopoverProvider
                attributes={{
                    href: new TextInputControl({ defaultValue: href }),
                    intent: new SelectControl({
                        options: ["none", "primary", "success", "warning", "danger"],
                        defaultValue: intent
                    }),
                    minimal: new CheckboxControl({
                        defaultValue: minimal,
                        label: "Minimal"
                    }),
                    outlined: new CheckboxControl({
                        defaultValue: outlined,
                        label: "Outlined"
                    }),
                    small: new CheckboxControl({ defaultValue: small, label: "Small" }),
                    large: new CheckboxControl({ defaultValue: large, label: "Large" }),
                    disabled: new CheckboxControl({
                        defaultValue: props.disabled,
                        label: "Disabled"
                    })
                }}
                targetRef={buttonRef}
                hoverSlopThreshold={32}
            >
                {buttonContent}
            </EditorComponentPopoverProvider>
        );
    }

    return buttonContent;
}
