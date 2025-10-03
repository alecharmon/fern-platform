import { ReactNode, useState } from "react";

import { SearchIcon } from "lucide-react";

import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface SearchableDropdownProps<T> {
    children: ReactNode;
    items: T[];
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onSelect: (item: T) => void;
    searchPlaceholder?: string;
    emptyMessage?: string;
    loadingMessage?: string;
    isLoading?: boolean;
    renderItem: (item: T, onSelect: () => void) => ReactNode;
    getItemKey: (item: T) => string;
    shouldShowSearch?: boolean;
}

export function SearchableDropdown<T>({
    children,
    items,
    searchTerm,
    onSearchChange,
    onSelect,
    searchPlaceholder = "Search...",
    emptyMessage = "No items found",
    loadingMessage = "Loading...",
    isLoading = false,
    renderItem,
    getItemKey,
    shouldShowSearch = true
}: SearchableDropdownProps<T>) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) {
                    onSearchChange("");
                }
            }}
        >
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-80 border border-[var(--border,var(--gray-500))] p-0" align="start">
                <div className="flex flex-col">
                    {shouldShowSearch && (
                        <div className="flex items-center border-b border-[var(--border,var(--gray-500))] p-2">
                            <div className="flex flex-1 items-center rounded-md border border-[var(--border,var(--gray-500))] px-3">
                                <SearchIcon className="h-4 w-4 shrink-0 opacity-50" />
                                <Input
                                    placeholder={searchPlaceholder}
                                    value={searchTerm}
                                    onChange={(e) => {
                                        onSearchChange(e.target.value);
                                    }}
                                    className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
                                />
                            </div>
                        </div>
                    )}
                    <div className="max-h-60 overflow-y-auto p-1">
                        {items.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                                {isLoading ? loadingMessage : searchTerm ? emptyMessage : emptyMessage}
                            </div>
                        ) : (
                            items.map((item) => (
                                <div key={getItemKey(item)}>
                                    {renderItem(item, () => {
                                        onSelect(item);
                                        setIsOpen(false);
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
