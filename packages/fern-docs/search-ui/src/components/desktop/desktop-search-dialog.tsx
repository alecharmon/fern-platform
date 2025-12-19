import { Button } from "@fern-docs/components/button";
import { t } from "@fern-docs/i18n";
import * as Dialog from "@radix-ui/react-dialog";
import { TooltipPortal } from "@radix-ui/react-tooltip";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ComponentPropsWithoutRef, memo, type PropsWithChildren, type ReactNode } from "react";

import { FERN_SEARCH_DIALOG_ID, FERN_SEARCH_DIALOG_OVERLAY_ID } from "../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { DesktopCommandAfterInput } from "./desktop-command";

const overlayVariants = {
    hidden: { opacity: 0, backdropFilter: "blur(0px)" },
    visible: { opacity: 1, backdropFilter: "blur(12px)" }
};

const contentVariants = {
    hidden: { opacity: 0, scale: 0.85 },
    visible: { opacity: 1, scale: 1 }
};

const transition = {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1] as const
};

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
        open,
        ...rest
    }: PropsWithChildren<
        {
            trigger?: ReactNode;
            asChild?: boolean;
            afterInput?: ReactNode;
            lang: string;
            open?: boolean;
        } & ComponentPropsWithoutRef<typeof Dialog.Root>
    >) => {
        return (
            <Dialog.Root open={open} {...rest}>
                {trigger}

                <DesktopCommandAfterInput>
                    {afterInput || (
                        <>
                            <DialogCloseEsc className="pointer-coarse:hidden shrink-0" lang={lang} />
                            <DialogCloseX className="pointer-coarse:flex hidden shrink-0" lang={lang} />
                        </>
                    )}
                </DesktopCommandAfterInput>

                <AnimatePresence>
                    {open && (
                        <Dialog.Portal forceMount>
                            <Dialog.Overlay forceMount asChild>
                                <motion.div
                                    id={FERN_SEARCH_DIALOG_OVERLAY_ID}
                                    variants={overlayVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="hidden"
                                    transition={transition}
                                />
                            </Dialog.Overlay>

                            <VisuallyHidden>
                                <Dialog.Title>{t(lang).search.search}</Dialog.Title>
                                <Dialog.Description>{t(lang).search.searchOurDocumentation}</Dialog.Description>
                            </VisuallyHidden>

                            <Dialog.Content
                                forceMount
                                id={FERN_SEARCH_DIALOG_ID}
                                asChild
                                onEscapeKeyDown={(e) => {
                                    e.preventDefault();
                                }}
                            >
                                <motion.div
                                    variants={contentVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="hidden"
                                    transition={transition}
                                >
                                    {children}
                                </motion.div>
                            </Dialog.Content>
                        </Dialog.Portal>
                    )}
                </AnimatePresence>
            </Dialog.Root>
        );
    }
);

DesktopSearchDialog.displayName = "DesktopSearchDialog";
