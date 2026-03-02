import type { Meta, StoryObj } from "@storybook/react";

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./table";

const meta: Meta<typeof Table> = {
    title: "UI/Table",
    component: Table,
    parameters: { layout: "centered" },
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Table>
            <TableCaption>A list of plants in your garden.</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead>Light</TableHead>
                    <TableHead className="text-right">Water (ml/week)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell className="font-medium">Monstera</TableCell>
                    <TableCell>Monstera deliciosa</TableCell>
                    <TableCell>Bright indirect</TableCell>
                    <TableCell className="text-right">500</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">Snake Plant</TableCell>
                    <TableCell>Dracaena trifasciata</TableCell>
                    <TableCell>Low to bright</TableCell>
                    <TableCell className="text-right">200</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">Pothos</TableCell>
                    <TableCell>Epipremnum aureum</TableCell>
                    <TableCell>Low to bright indirect</TableCell>
                    <TableCell className="text-right">350</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">Fiddle Leaf Fig</TableCell>
                    <TableCell>Ficus lyrata</TableCell>
                    <TableCell>Bright indirect</TableCell>
                    <TableCell className="text-right">600</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
};

export const Empty: Story = {
    render: () => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No plants found.
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
};
