import type { Table } from "@tanstack/react-table";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import { ExportButton } from "./ExportButton";

interface QueriesDataTableHeaderProps<TData> {
    table: Table<TData>;
    onExport: () => void;
    isExporting?: boolean;
}

export function QueriesDataTableHeader<TData>({ table, onExport, isExporting }: QueriesDataTableHeaderProps<TData>) {
    return (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="relative min-w-[200px]">
                <Search className="text-radix-gray-9 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                    placeholder="Search..."
                    value={(table.getColumn("conversation")?.getFilterValue() as string) ?? ""}
                    onChange={(event) => table.getColumn("conversation")?.setFilterValue(event.target.value)}
                    className="text-radix-gray-9 placeholder:text-radix-gray-9 h-9 max-w-sm rounded-md pl-9"
                    autoFocus
                />
            </div>
            <ExportButton onClick={onExport} isLoading={isExporting} />
        </div>
    );
}
