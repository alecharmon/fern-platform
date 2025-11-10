import { Button } from "@fern-docs/components/button";
import { t } from "@fern-docs/i18n";
import * as Dialog from "@radix-ui/react-dialog";
import { TooltipPortal } from "@radix-ui/react-tooltip";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import { type ComponentPropsWithoutRef, memo, type PropsWithChildren, type ReactNode } from "react";

import { FERN_SEARCH_DIALOG_ID, FERN_SEARCH_DIALOG_OVERLAY_ID } from "../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { DesktopCommandAfterInput } from "./desktop-command";

function DialogCloseEsc({ className, lang }: { className?: string; lang: string }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Dialog.DialogClose asChild>
                        <Button
                            size="xs"
                            variant="outline"
                            className={className}
                            aria-label={t(lang).search.closeSearch}
                        >
                            <kbd>Esc</kbd>
                        </Button>
                    </Dialog.DialogClose>
                </TooltipTrigger>
                <TooltipPortal>
                    <TooltipContent>
                        <p>{t(lang).search.closeSearch}</p>
                    </TooltipContent>
                </TooltipPortal>
            </Tooltip>
        </TooltipProvider>
    );
}

function DialogCloseX({ className, lang }: { className?: string; lang: string }) {
    return (
        <Dialog.DialogClose asChild>
            <Button size="icon" variant="outline" className={className} aria-label={t(lang).search.closeSearch}>
                <X />
            </Button>
        </Dialog.DialogClose>
    );
}
export const DesktopSearchDialog = memo(
    ({
        children,
        asChild,
        trigger,
        afterInput,
        lang,
        ...rest
    }: PropsWithChildren<
        {
            trigger?: ReactNode;
            asChild?: boolean;
            afterInput?: ReactNode;
            lang: string;
        } & ComponentPropsWithoutRef<typeof Dialog.Root>
    >) => {
        return (
            <Dialog.Root {...rest}>
                {trigger}

                <DesktopCommandAfterInput>
                    {afterInput || (
                        <>
                            <DialogCloseEsc className="pointer-coarse:hidden shrink-0" lang={lang} />
                            <DialogCloseX className="pointer-coarse:flex hidden shrink-0" lang={lang} />
                        </>
                    )}
                </DesktopCommandAfterInput>

                <Dialog.Portal>
                    <Dialog.Overlay id={FERN_SEARCH_DIALOG_OVERLAY_ID} />

                    <VisuallyHidden>
                        <Dialog.Title>{t(lang).search.search}</Dialog.Title>
                        <Dialog.Description>{t(lang).search.searchOurDocumentation}</Dialog.Description>
                    </VisuallyHidden>

                    <Dialog.Content
                        id={FERN_SEARCH_DIALOG_ID}
                        asChild={asChild}
                        onEscapeKeyDown={(e) => {
                            e.preventDefault();
                        }}
                    >
                        {children}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        );
    }
);

DesktopSearchDialog.displayName = "DesktopSearchDialog";
