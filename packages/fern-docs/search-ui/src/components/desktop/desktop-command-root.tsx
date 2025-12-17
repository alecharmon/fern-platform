import { cn } from "@fern-docs/components/cn";
import { t } from "@fern-docs/i18n";
import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";
import {
    type ComponentPropsWithoutRef,
    forwardRef,
    type KeyboardEventHandler,
    useCallback,
    useRef,
    useState
} from "react";

import * as Command from "../cmdk";
import { CommandUxProvider } from "../shared/command-ux";

export const DesktopCommandRoot = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof Command.Root> & {
        onEscapeKeyDown?: KeyboardEventHandler<HTMLDivElement>;
        onPopState?: KeyboardEventHandler<HTMLDivElement>;
        escapeKeyShouldPopState?: boolean;
        lang: string;
    }
>(({ children, onEscapeKeyDown, onPopState, escapeKeyShouldPopState, lang, ...props }, forwardedRef) => {
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const [inputError, setInputError] = useState<string | null | undefined>(null);
    const setInputRef = useCallback((ref: HTMLInputElement | HTMLTextAreaElement | null) => {
        inputRef.current = ref;
    }, []);

    return (
        <CommandUxProvider setInputRef={setInputRef} inputError={inputError} setInputError={setInputError}>
            <Command.Root
                label={t(lang).search.search}
                ref={composeRefs(forwardedRef, ref)}
                {...props}
                onKeyDown={composeEventHandlers(
                    props.onKeyDown,
                    (e) => {
                        // on keydown, clear input error
                        setInputError(null);

                        // if escape, handle it
                        if (e.key === "Escape") {
                            if (inputRef.current?.value.length) {
                                inputRef.current?.dispatchEvent(new Event("cmdk-fern-clear-input"));
                            } else if (escapeKeyShouldPopState) {
                                onPopState?.(e);
                            } else {
                                onEscapeKeyDown?.(e);
                            }
                            return;
                        }

                        const input = inputRef.current;

                        if (e.key === "Backspace" && !input?.value.length) {
                            onPopState?.(e);
                            return;
                        }
                    },
                    { checkForDefaultPrevented: false }
                )}
                onKeyDownCapture={composeEventHandlers(props.onKeyDownCapture, (e) => {
                    if (
                        document.activeElement instanceof HTMLInputElement ||
                        document.activeElement instanceof HTMLTextAreaElement
                    ) {
                        return;
                    }

                    // if input is alphanumeric, space, backspace, delete, arrow left, arrow right, then focus input
                    // note: this func is onKeyDownCapture so it will fire before the input
                    // which is important so that the first character typed isn't swallowed
                    if (
                        (/^[a-zA-Z0-9]$/.test(e.key) ||
                            e.key === " " ||
                            e.key === "Backspace" ||
                            e.key === "Delete" ||
                            e.key === "ArrowLeft" ||
                            e.key === "ArrowRight") &&
                        !e.ctrlKey &&
                        !e.metaKey
                    ) {
                        // focus input immediately:
                        inputRef.current?.focus();
                    }
                })}
                className={cn(
                    props["data-mode" as keyof typeof props] === "ask-ai" &&
                        (props["data-location" as keyof typeof props] === "modal" ? "h-[70%]" : "h-full")
                )}
            >
                {children}
            </Command.Root>
        </CommandUxProvider>
    );
});

DesktopCommandRoot.displayName = "DesktopCommandRoot";
