"use client";

import { conformExplorerRoute } from "@fern-api/docs-utils";
import { FERN_PLAYGROUND_FLOATING_BUTTON_ID } from "@fern-docs/components/constants";
import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useCurrentVersionSlug } from "@fern-docs/components/state/navigation";
import { ChevronUp, SquareTerminal } from "lucide-react";

import { I18N } from "@/constants";

// TODO(catherine): add this to the endpoint content
export const PlaygroundFloatingButton = () => {
    const slug = useCurrentVersionSlug();

    return (
        <FernTooltipProvider>
            <FernTooltip
                content={
                    <span>
                        {I18N.apiReference.customizeAndRunIn}
                        <span className="text-(color:--accent-a11) font-semibold">{I18N.apiReference.apiExplorer}</span>
                    </span>
                }
            >
                <ButtonLink
                    // TODO: ensure this button does not render multiple times, otherwise
                    // remove this ID.
                    id={FERN_PLAYGROUND_FLOATING_BUTTON_ID}
                    href={slug ? conformExplorerRoute(slug) : "?explorer=true"}
                >
                    <SquareTerminal height={16} width={16} />

                    <ChevronUp height={16} width={16} className="nav-arrow" />
                </ButtonLink>
            </FernTooltip>
        </FernTooltipProvider>
    );
};
