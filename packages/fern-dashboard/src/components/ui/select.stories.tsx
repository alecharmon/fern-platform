import type { Meta, StoryObj } from "@storybook/react";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from "./select";

const meta: Meta<typeof Select> = {
    title: "UI/Select",
    component: Select,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Select>
            <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a plant..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="monstera">Monstera deliciosa</SelectItem>
                <SelectItem value="pothos">Golden Pothos</SelectItem>
                <SelectItem value="snake">Snake Plant</SelectItem>
                <SelectItem value="fiddle">Fiddle Leaf Fig</SelectItem>
            </SelectContent>
        </Select>
    )
};

export const WithGroups: Story = {
    render: () => (
        <Select>
            <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a plant..." />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Tropical</SelectLabel>
                    <SelectItem value="monstera">Monstera deliciosa</SelectItem>
                    <SelectItem value="pothos">Golden Pothos</SelectItem>
                    <SelectItem value="bird">Bird of Paradise</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                    <SelectLabel>Succulents</SelectLabel>
                    <SelectItem value="aloe">Aloe Vera</SelectItem>
                    <SelectItem value="jade">Jade Plant</SelectItem>
                    <SelectItem value="echeveria">Echeveria</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    )
};

export const WithDescriptions: Story = {
    render: () => (
        <Select>
            <SelectTrigger className="w-72">
                <SelectValue placeholder="Select watering schedule..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="daily" description="Water every day">
                    Daily
                </SelectItem>
                <SelectItem value="weekly" description="Water once per week">
                    Weekly
                </SelectItem>
                <SelectItem value="biweekly" description="Water every two weeks">
                    Bi-weekly
                </SelectItem>
                <SelectItem value="monthly" description="Water once per month">
                    Monthly
                </SelectItem>
            </SelectContent>
        </Select>
    )
};

export const Small: Story = {
    render: () => (
        <Select>
            <SelectTrigger className="w-48" size="sm">
                <SelectValue placeholder="Light level..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="low">Low light</SelectItem>
                <SelectItem value="medium">Medium light</SelectItem>
                <SelectItem value="bright">Bright indirect</SelectItem>
                <SelectItem value="direct">Direct sunlight</SelectItem>
            </SelectContent>
        </Select>
    )
};

export const WithDisabledItems: Story = {
    render: () => (
        <Select>
            <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a plant..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="monstera">Monstera deliciosa</SelectItem>
                <SelectItem value="pothos">Golden Pothos</SelectItem>
                <SelectItem value="rare" disabled>
                    Ghost Orchid (unavailable)
                </SelectItem>
                <SelectItem value="snake">Snake Plant</SelectItem>
            </SelectContent>
        </Select>
    )
};
