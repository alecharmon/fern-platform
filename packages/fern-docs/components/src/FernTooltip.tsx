"use client";

import { FC, ReactNode } from "react";

import * as Tooltip from "@radix-ui/react-tooltip";
import { VariantProps, cva } from "class-variance-authority";

import { cn } from "./cn";

const tooltipVariants = cva(
  "animate-popover rounded-2 shadow-card-grayscale z-50 max-w-xs border p-2 text-center text-sm leading-normal backdrop-blur will-change-[transform,opacity]",
  {
    variants: {
      variant: {
        default: "bg-background border-border-default",
        dashboard: "border-none bg-[#252529] text-white", // NOTE: this color is hardcoded for dashboard, we should rename & use a theme variable if we want to use it in other places
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface FernTooltipProps
  extends Tooltip.TooltipProps,
    Omit<Tooltip.TooltipContentProps, "content"> {
  content: ReactNode | undefined;
  container?: HTMLElement | null;
  variant?: VariantProps<typeof tooltipVariants>["variant"];
}

export const FernTooltip: FC<FernTooltipProps> = ({
  content,
  children,
  open,
  defaultOpen,
  onOpenChange,
  delayDuration,
  disableHoverableContent,
  container,
  variant,
  ...props
}) => {
  if (content == null || content === "") {
    return <>{children}</>;
  }
  return (
    <Tooltip.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
    >
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal container={container}>
        <Tooltip.Content
          sideOffset={6}
          collisionPadding={6}
          {...props}
          className={cn(tooltipVariants({ variant }), props.className)}
        >
          {content}
          {variant === "dashboard" && (
            <Tooltip.Arrow className="fill-[#252529]" />
          )}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

export const FernTooltipProvider = Tooltip.Provider;
