"use client";

import { ChevronUp, SquareTerminal } from "lucide-react";

import { conformExplorerRoute } from "@fern-api/docs-utils";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components";
import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { FERN_PLAYGROUND_FLOATING_BUTTON_ID } from "@fern-docs/components/constants";
import { useCurrentVersionSlug } from "@fern-docs/components/state/navigation";

// TODO(catherine): add this to the endpoint content
export const PlaygroundFloatingButton = () => {
    const slug = useCurrentVersionSlug();

    return (
        <FernTooltipProvider>
            <FernTooltip
                content={
                    <span>
                        Customize and run in{" "}
                        <span className="text-(color:--accent-a11) font-semibold">API Explorer</span>
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
