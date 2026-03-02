import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta: Meta<typeof RadioGroup> = {
    title: "UI/RadioGroup",
    component: RadioGroup,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <RadioGroup defaultValue="weekly">
            <div className="flex items-center gap-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily">Daily</Label>
            </div>
            <div className="flex items-center gap-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly">Weekly</Label>
            </div>
            <div className="flex items-center gap-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly">Monthly</Label>
            </div>
        </RadioGroup>
    )
};

export const WithDescriptions: Story = {
    render: () => (
        <RadioGroup defaultValue="bright">
            <div className="flex items-start gap-2">
                <RadioGroupItem value="low" id="low" className="mt-1" />
                <div>
                    <Label htmlFor="low">Low light</Label>
                    <p className="text-xs text-muted-foreground">Suitable for snake plants and pothos.</p>
                </div>
            </div>
            <div className="flex items-start gap-2">
                <RadioGroupItem value="bright" id="bright" className="mt-1" />
                <div>
                    <Label htmlFor="bright">Bright indirect</Label>
                    <p className="text-xs text-muted-foreground">Ideal for monstera and fiddle leaf figs.</p>
                </div>
            </div>
            <div className="flex items-start gap-2">
                <RadioGroupItem value="direct" id="direct" className="mt-1" />
                <div>
                    <Label htmlFor="direct">Direct sunlight</Label>
                    <p className="text-xs text-muted-foreground">Best for cacti and succulents.</p>
                </div>
            </div>
        </RadioGroup>
    )
};

export const Disabled: Story = {
    render: () => (
        <RadioGroup defaultValue="weekly" disabled>
            <div className="flex items-center gap-2">
                <RadioGroupItem value="daily" id="d-daily" />
                <Label htmlFor="d-daily">Daily</Label>
            </div>
            <div className="flex items-center gap-2">
                <RadioGroupItem value="weekly" id="d-weekly" />
                <Label htmlFor="d-weekly">Weekly</Label>
            </div>
            <div className="flex items-center gap-2">
                <RadioGroupItem value="monthly" id="d-monthly" />
                <Label htmlFor="d-monthly">Monthly</Label>
            </div>
        </RadioGroup>
    )
};
