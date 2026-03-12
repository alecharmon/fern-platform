import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode, useState } from "react";
import { fn } from "storybook/test";

import { Button } from "@/components/ui/button";

import type { UpsellFeature } from "./types";

// ---------------------------------------------------------------------------
// Presentational wrapper that demonstrates UpsellGate behavior without providers.
// Shows the three visual states: entitled, not-entitled (gated), and loading.
// ---------------------------------------------------------------------------

type GateState = "entitled" | "not-entitled" | "loading";

interface UpsellGateStoryProps {
    feature: UpsellFeature;
    state: GateState;
    onGatedClick: () => void;
    children?: ReactNode;
}

function UpsellGateStory({ feature, state, onGatedClick, children }: UpsellGateStoryProps) {
    const content = children ?? (
        <Button variant="outline" className="pointer-events-none">
            Gated action
        </Button>
    );

    if (state === "loading") {
        return <div className="pointer-events-none animate-pulse opacity-50">{content}</div>;
    }

    if (state === "entitled") {
        return <>{content}</>;
    }

    // Not entitled — intercept clicks
    return (
        <div className="relative">
            {content}
            <div
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onGatedClick();
                }}
                role="presentation"
                aria-label={`Upgrade required for ${feature.replace(/_/g, " ")}`}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof UpsellGateStory> = {
    title: "Upsells/UpsellGate",
    component: UpsellGateStory,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        feature: {
            control: { type: "select" },
            options: [
                "seats",
                "ai_credits",
                "custom_domain_subpath",
                "docs_sites",
                "custom_domains",
                "pdf_export",
                "password_protection"
            ] satisfies UpsellFeature[]
        },
        state: {
            control: { type: "inline-radio" },
            options: ["entitled", "not-entitled", "loading"] satisfies GateState[]
        }
    },
    args: {
        feature: "seats",
        onGatedClick: fn()
    }
};

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Entitled: Story = {
    args: { state: "entitled" }
};

export const NotEntitled: Story = {
    name: "Not entitled (gated)",
    args: { state: "not-entitled" }
};

export const Loading: Story = {
    args: { state: "loading" }
};

/** Interactive demo that toggles between entitled and gated states. */
export const Interactive: Story = {
    args: { state: "not-entitled" },
    render: (args) => {
        const [gateState, setGateState] = useState<GateState>("not-entitled");
        return (
            <div className="flex flex-col items-center gap-4">
                <div className="flex gap-2">
                    <Button
                        variant={gateState === "entitled" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGateState("entitled")}
                    >
                        Entitled
                    </Button>
                    <Button
                        variant={gateState === "not-entitled" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGateState("not-entitled")}
                    >
                        Not entitled
                    </Button>
                    <Button
                        variant={gateState === "loading" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGateState("loading")}
                    >
                        Loading
                    </Button>
                </div>
                <UpsellGateStory {...args} state={gateState} />
            </div>
        );
    }
};
