"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/utils/utils";

import { Button } from "./button";

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn(
      "flex w-full flex-row items-center justify-center gap-1",
      className
    )}
    {...props}
  />
));
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
));
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<typeof Button>;

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <Button
    aria-current={isActive ? "page" : undefined}
    variant={isActive ? "outline" : "ghost"}
    size={size}
    className={cn(
      "h-8 w-8",
      isActive && "bg-primary text-primary-foreground hover:bg-primary/90",
      className
    )}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("w-fit gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("w-fit gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

const __generatePageNumbers = (
  currentPage: number,
  totalPages: number,
  maxVisiblePages: number
) => {
  const pages: (number | string)[] = [];
  const clampedMax = Math.max(2, Math.floor(maxVisiblePages));

  if (totalPages <= clampedMax) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const windowSize = clampedMax - 2; // exclude first and last
  let start = Math.max(2, currentPage - Math.floor(windowSize / 2));
  const end = Math.min(totalPages - 1, start + windowSize - 1);
  start = Math.max(2, end - windowSize + 1);

  pages.push(1);
  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);

  return pages;
};

const Pagination = ({
  currentPage,
  setCurrentPage,
  isLoading,
  totalPages,
  className,
}: {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  isLoading: boolean;
  totalPages: number;
  className?: string;
}) => {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile("matches" in e ? e.matches : (e as MediaQueryList).matches);
    };
    onChange(mql);
    mql.addEventListener("change", onChange as (e: Event) => void);
    return () => {
      mql.removeEventListener("change", onChange as (e: Event) => void);
    };
  }, []);

  const maxVisiblePages = isMobile ? 3 : 7;
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center gap-2", className)}
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => {
              setCurrentPage(Math.max(1, currentPage - 1));
            }}
            disabled={currentPage === 1 || isLoading}
          />
        </PaginationItem>

        {__generatePageNumbers(currentPage, totalPages, maxVisiblePages).map(
          (page, index) => (
            <PaginationItem key={index}>
              {page === "ellipsis" ? (
                <PaginationEllipsis className="w-8" />
              ) : (
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => {
                    setCurrentPage(page as number);
                  }}
                  disabled={isLoading}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            onClick={() => {
              setCurrentPage(Math.min(totalPages, currentPage + 1));
            }}
            disabled={currentPage === totalPages || isLoading}
          />
        </PaginationItem>
      </PaginationContent>
    </nav>
  );
};

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
