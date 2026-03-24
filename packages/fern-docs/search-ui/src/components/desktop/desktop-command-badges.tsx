import { tunnel } from "@fern-ui/react-commons";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

interface DesktopCommandBadgesProps {
    onDropdownClose?: () => void;
    lang: string;
}

export const aboveInput = tunnel();

export const DesktopCommandBadges = forwardRef<
    HTMLDivElement,
    DesktopCommandBadgesProps & ComponentPropsWithoutRef<"div"> & { modal?: boolean }
>((props, ref) => {
    const { onDropdownClose, children, lang, modal, ...rest } = props;
    const hasChildren = aboveInput.useHasChildren();

    if (!hasChildren) {
        return false;
    }

    return (
        <div ref={ref} className="flex items-center gap-2 p-2 pb-0" {...rest}>
            <aboveInput.Out />
        </div>
    );
});

DesktopCommandBadges.displayName = "DesktopCommandBadges";

export const DesktopCommandAboveInput = aboveInput.In;
