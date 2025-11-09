"use client";

import type { Column } from "@tanstack/react-table";
import { Filter, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils/utils";

interface ColumnHeaderWithFilterProps<TData, TValue> {
    column: Column<TData, TValue>;
    title: string;
    className?: string;
}

export function ColumnHeaderWithFilter<TData, TValue>({
    column,
    title,
    className
}: ColumnHeaderWithFilterProps<TData, TValue>) {
    const [isOpen, setIsOpen] = useState(false);
    const [filterValue, setFilterValue] = useState<string>((column.getFilterValue() as string) ?? "");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const uniqueValues = useMemo(() => {
        const facetedValues = column.getFacetedUniqueValues();
        const values: string[] = [];

        facetedValues.forEach((count, value) => {
            let displayValue = String(value);

            if (typeof value === "boolean") {
                displayValue = value ? "True" : "False";
            }

            values.push(displayValue);
        });

        return values.sort();
    }, [column]);

    const filteredValues = useMemo(() => {
        if (!filterValue) return uniqueValues;
        const searchLower = filterValue.toLowerCase();
        return uniqueValues.filter((value) => value.toLowerCase().includes(searchLower));
    }, [uniqueValues, filterValue]);

    const handleFilterChange = (value: string) => {
        setFilterValue(value);
        column.setFilterValue(value || undefined);
    };

    const handleSelectValue = (value: string) => {
        setFilterValue(value);
        column.setFilterValue(value);
    };

    const handleClearFilter = () => {
        setFilterValue("");
        column.setFilterValue(undefined);
        setIsOpen(false);
    };

    const isFiltered = column.getFilterValue() !== undefined;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn("h-auto p-0! hover:bg-transparent font-normal justify-start gap-1!", className)}
                    style={{ fontFamily: "Berkeley Mono, monospace" }}
                >
                    <span>{title}</span>
                    {isFiltered ? (
                        <Filter className="h-3 w-3" />
                    ) : (
                        <Filter className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-2">
                    <div className="text-sm font-medium">Filter by {title}</div>
                    <div className="relative">
                        <Input
                            ref={inputRef}
                            placeholder={`Search ${title.toLowerCase()}...`}
                            value={filterValue}
                            onChange={(e) => handleFilterChange(e.target.value)}
                            className="pr-8"
                        />
                        {filterValue && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                                onClick={handleClearFilter}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    {filteredValues.length > 0 && (
                        <div className="max-h-48 overflow-y-auto border rounded-md">
                            {filteredValues.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleSelectValue(value)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors",
                                        filterValue === value && "bg-gray-100 font-medium"
                                    )}
                                >
                                    <span className="block truncate">{value}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {isFiltered && (
                        <Button variant="outline" size="sm" onClick={handleClearFilter} className="w-full">
                            Clear filter
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
