import { ComponentPropsWithoutRef, forwardRef, memo } from "react";

import { VariantProps, cva } from "class-variance-authority";
import { SearchIcon } from "lucide-react";

import { Kbd } from "@fern-docs/components";
import { cn } from "@fern-docs/components";

const buttonVariants = cva(
  "focus-visible:ring-(color:--accent) rounded-3/2 inline-flex h-9 items-center justify-start gap-2 whitespace-nowrap p-2 text-sm font-medium transition-colors hover:transition-none focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-(color:--grayscale-a11) hover:bg-(color:--grayscale-a3) ring-border-default cursor-text bg-transparent ring-1 ring-inset",
        loading:
          "text-(color:--grayscale-a11) ring-border-default cursor-not-allowed bg-transparent ring-1 ring-inset",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export const DesktopSearchButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> &
    VariantProps<typeof buttonVariants> & {
      placeholder?: string;
      isSearchInSidebar?: boolean;
    }
>(
  (
    {
      children,
      variant,
      placeholder = "Search",
      className,
      isSearchInSidebar,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        {...rest}
        className={buttonVariants({ variant, className })}
        ref={ref}
      >
        <SearchIcon />
        {placeholder}
        <CommandKbd className="pointer-coarse:hidden ml-auto" />
      </button>
    );
  }
);

DesktopSearchButton.displayName = "DesktopSearchButton";

export const CommandKbd = memo(({ className }: { className?: string }) => {
  return (
    <div className={cn("inline-flex", className)}>
      <Kbd>{"/"}</Kbd>
    </div>
  );
});

CommandKbd.displayName = "CommandKbd";
