import { SearchIcon } from "lucide-react";
import {
    forwardRef,
    type KeyboardEvent,
    type ReactNode,
    useEffect,
    useImperativeHandle,
    useRef,
    useState
} from "react";

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
    renderItem: (item: T, onSelect: () => void, isHighlighted: boolean) => ReactNode;
    getItemKey: (item: T) => string;
    shouldShowSearch?: boolean;
    searchRightContent?: ReactNode;
    headerContent?: ReactNode;
}

export interface SearchableDropdownRef {
    open: () => void;
}

function SearchableDropdownInner<T>(
    {
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
        shouldShowSearch = true,
        searchRightContent,
        headerContent
    }: SearchableDropdownProps<T>,
    ref: React.Ref<SearchableDropdownRef>
) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
        open: () => {
            setIsOpen(true);
        }
    }));

    // Reset highlighted index when items change
    useEffect(() => {
        setHighlightedIndex(0);
    }, [items]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && shouldShowSearch) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
        }
    }, [isOpen, shouldShowSearch]);

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (items.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setHighlightedIndex((prev) => Math.min(prev + 1, items.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                break;
            case "Enter":
                e.preventDefault();
                if (items[highlightedIndex] != null) {
                    onSelect(items[highlightedIndex]);
                    setIsOpen(false);
                }
                break;
            case "Escape":
                e.preventDefault();
                setIsOpen(false);
                break;
        }
    };

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
                    {headerContent && (
                        <div className="border-b border-[var(--border,var(--gray-500))] p-2">{headerContent}</div>
                    )}
                    {shouldShowSearch && (
                        <div className="flex items-center gap-2 border-b border-[var(--border,var(--gray-500))] p-2">
                            <div className="flex flex-1 items-center rounded-md border border-[var(--border,var(--gray-500))] px-3">
                                <SearchIcon className="h-4 w-4 shrink-0 opacity-50" />
                                <Input
                                    ref={inputRef}
                                    placeholder={searchPlaceholder}
                                    value={searchTerm}
                                    onChange={(e) => {
                                        onSearchChange(e.target.value);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
                                />
                            </div>
                            {searchRightContent}
                        </div>
                    )}
                    <div className="flex flex-col max-h-60 overflow-y-auto p-1 gap-px">
                        {items.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                                {isLoading ? loadingMessage : searchTerm ? emptyMessage : emptyMessage}
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div key={getItemKey(item)} onMouseEnter={() => setHighlightedIndex(index)}>
                                    {renderItem(
                                        item,
                                        () => {
                                            onSelect(item);
                                            setIsOpen(false);
                                        },
                                        index === highlightedIndex
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export const SearchableDropdown = forwardRef(SearchableDropdownInner) as <T>(
    props: SearchableDropdownProps<T> & { ref?: React.Ref<SearchableDropdownRef> }
) => ReturnType<typeof SearchableDropdownInner>;
