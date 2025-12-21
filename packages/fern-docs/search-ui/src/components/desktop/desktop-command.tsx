import { Button } from "@fern-docs/components/button";
import { Kbd } from "@fern-docs/components/kbd";
import { t } from "@fern-docs/i18n";
import { tunnel, usePlatformKbdShortcut } from "@fern-ui/react-commons";
import { composeEventHandlers } from "@radix-ui/primitive";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { TooltipPortal } from "@radix-ui/react-tooltip";
import { ArrowLeft } from "lucide-react";
import {
    type ComponentPropsWithoutRef,
    forwardRef,
    type KeyboardEvent,
    memo,
    type ReactNode,
    useEffect,
    useRef
} from "react";
import * as Command from "../cmdk";
import { useFacetFilters } from "../search/useFacetFilters";
import { useSearchBox } from "../search/useSearchBox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { DesktopCommandBadges } from "./desktop-command-badges";
import { DesktopCommandInput, DesktopCommandInputError } from "./desktop-command-input";
import { DesktopCommandRoot } from "./desktop-command-root";

export interface DesktopCommandProps {
    onEscapeKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
    onPopState?: (e: KeyboardEvent<HTMLDivElement>) => void;
    placeholder?: string;
    lang: string;
    /**
     * Initial query to pre-populate the search input (for deep linking).
     * This will be applied once when the component mounts.
     */
    initialQuery?: string;
    /**
     * Callback to clear the initial query after it has been applied.
     */
    onInitialQueryApplied?: () => void;
}

export const beforeInput = tunnel();
export const afterInput = tunnel();

/**
 * The desktop command is intended to be used within a dialog component.
 */
const DesktopCommand = forwardRef<
    HTMLDivElement,
    DesktopCommandProps & ComponentPropsWithoutRef<typeof DesktopCommandRoot>
>(
    (
        { onPopState, children, placeholder, asChild, lang, initialQuery, onInitialQueryApplied, ...props },
        forwardedRef
    ) => {
        const { filters, handlePopState: handlePopFilters } = useFacetFilters();
        const ref = useRef<HTMLDivElement>(null);

        // animate on presence
        useEffect(() => {
            if (ref.current) {
                ref.current.animate(
                    { transform: ["scale(0.96)", "scale(1)"] },
                    { duration: 100, easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }
                );
            }
        }, []);

        return (
            <DesktopCommandRoot
                label={t(lang).search.search}
                {...props}
                ref={composeRefs(forwardedRef, ref)}
                onPopState={composeEventHandlers(onPopState, handlePopFilters, {
                    checkForDefaultPrevented: false
                })}
                escapeKeyShouldPopState={filters.length > 0}
                data-fern-search="desktop-command"
                data-location="modal"
                data-mode={"search"}
                lang={lang}
            >
                <DesktopCommandContent
                    asChild={asChild}
                    lang={lang}
                    initialQuery={initialQuery}
                    onInitialQueryApplied={onInitialQueryApplied}
                >
                    {children}
                </DesktopCommandContent>
            </DesktopCommandRoot>
        );
    }
);

DesktopCommand.displayName = "DesktopCommand";

export const DesktopCommandContent = memo(
    ({
        children,
        asChild,
        modal,
        lang,
        initialQuery,
        onInitialQueryApplied
    }: {
        children: React.ReactNode;
        asChild?: boolean;
        modal?: boolean;
        lang: string;
        initialQuery?: string;
        onInitialQueryApplied?: () => void;
    }) => {
        const inputRef = useRef<HTMLInputElement>(null);
        const scrollRef = useRef<HTMLDivElement>(null);
        return (
            <>
                <div
                    className="cursor-text"
                    onClick={() => {
                        inputRef.current?.focus();
                    }}
                >
                    <DesktopCommandBadges modal={modal} lang={lang} />

                    <div data-cmdk-fern-header="">
                        <beforeInput.Out />

                        <DesktopCommandInputError asChild>
                            <DesktopCommandInputSearch
                                ref={inputRef}
                                lang={lang}
                                initialQuery={initialQuery}
                                onInitialQueryApplied={onInitialQueryApplied}
                            />
                        </DesktopCommandInputError>

                        <afterInput.Out />
                    </div>
                </div>

                <Command.List ref={scrollRef} tabIndex={-1} asChild={asChild}>
                    {children}
                </Command.List>
            </>
        );
    }
);

DesktopCommandContent.displayName = "DesktopCommandContent";

const DesktopCommandInputSearch = memo(
    forwardRef<
        HTMLInputElement,
        ComponentPropsWithoutRef<typeof DesktopCommandInput> & {
            lang: string;
            initialQuery?: string;
            onInitialQueryApplied?: () => void;
        }
    >(({ lang, initialQuery, onInitialQueryApplied, ...props }, forwardedRef) => {
        const inputRef = useRef<HTMLInputElement>(null);
        const { query, refine } = useSearchBox();
        const initialQueryAppliedRef = useRef(false);

        // Apply initial query from deep linking (one-time, via props)
        useEffect(() => {
            if (initialQuery && !initialQueryAppliedRef.current && initialQuery !== query) {
                initialQueryAppliedRef.current = true;
                refine(initialQuery);
                onInitialQueryApplied?.();
            }
        }, [initialQuery, query, refine, onInitialQueryApplied]);

        useEffect(() => {
            setTimeout(() => {
                if (document.activeElement !== inputRef.current) {
                    inputRef.current?.focus();
                }
            });
        });
        return (
            <DesktopCommandInput
                inputMode="search"
                autoFocus
                value={query}
                maxLength={100}
                placeholder={t(lang).search.search}
                {...props}
                ref={composeRefs(inputRef, forwardedRef)}
                onValueChange={(value) => {
                    refine(value);
                    props.onValueChange?.(value);
                }}
            />
        );
    })
);

DesktopCommandInputSearch.displayName = "DesktopCommandInputSearch";

function DesktopBackButton({
    pop,
    clear,
    showAdditionalCommand,
    lang
}: {
    pop: () => void;
    clear: () => void;
    /**
     * if false, the text says `Del` to go back
     * if true, the text says `Del` to go back or `Ctrl` `Del` to go to root search
     */
    showAdditionalCommand?: boolean;
    lang: string;
}): React.ReactNode {
    const shortcut = usePlatformKbdShortcut();

    const additionalCommand = showAdditionalCommand && shortcut && (
        <>
            <span>{t(lang).search.or}</span>
            <Kbd className="mx-1">{shortcut}</Kbd>
            <Kbd className="me-1">Del</Kbd>
            <span>{t(lang).search.toGoToRootSearch}</span>
        </>
    );

    return (
        <beforeInput.In>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="iconSm"
                            variant="outline"
                            className="shrink-0"
                            onClickCapture={(e) => {
                                if (e.metaKey || e.ctrlKey) {
                                    clear();
                                } else {
                                    pop();
                                }
                            }}
                            onKeyDownCapture={(e) => {
                                if (
                                    e.key === "Backspace" ||
                                    e.key === "Delete" ||
                                    e.key === "Space" ||
                                    (e.key === "Enter" && !e.nativeEvent.isComposing)
                                ) {
                                    if (e.metaKey || e.ctrlKey) {
                                        clear();
                                    } else {
                                        pop();
                                    }
                                    e.stopPropagation();
                                }
                            }}
                        >
                            <ArrowLeft />
                        </Button>
                    </TooltipTrigger>
                    <TooltipPortal>
                        <TooltipContent className="shrink-0">
                            <p>
                                <Kbd className="me-1">Del</Kbd>
                                <span> {t(lang).search.toGoBack}</span>
                                {additionalCommand}
                            </p>
                        </TooltipContent>
                    </TooltipPortal>
                </Tooltip>
            </TooltipProvider>
        </beforeInput.In>
    );
}

const DefaultDesktopBackButton = ({ lang }: { lang: string }): ReactNode => {
    const { filters, popFilter, clearFilters } = useFacetFilters();

    if (filters.length === 0) {
        return false;
    }

    return <DesktopBackButton pop={popFilter} clear={clearFilters} lang={lang} />;
};

const DesktopCommandAfterInput = afterInput.In;

export { DefaultDesktopBackButton, DesktopBackButton, DesktopCommand, DesktopCommandAfterInput };
