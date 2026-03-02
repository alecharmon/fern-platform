import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta: Meta<typeof Popover> = {
    title: "UI/Popover",
    component: Popover,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Plant dimensions</h4>
                        <p className="text-sm text-muted-foreground">Set the height and spread for this plant.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                            <Label htmlFor="height" className="w-20">
                                Height
                            </Label>
                            <Input id="height" defaultValue="120cm" className="h-8" />
                        </div>
                        <div className="flex items-center gap-4">
                            <Label htmlFor="spread" className="w-20">
                                Spread
                            </Label>
                            <Input id="spread" defaultValue="60cm" className="h-8" />
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
};

export const OpenByDefault: Story = {
    render: () => (
        <Popover defaultOpen>
            <PopoverTrigger asChild>
                <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>
                <p className="text-sm">This popover is open by default.</p>
            </PopoverContent>
        </Popover>
    )
};
