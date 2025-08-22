"use client";

import { useCallback, useRef } from "react";

import { cn } from "@/utils/utils";

interface TeleprompterTextOnHoverProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  containerClassName?: string;
  disabled?: boolean;
}

export function TeleprompterTextOnHover({
  children,
  className,
  duration = 2,
  containerClassName,
  disabled = false,
}: TeleprompterTextOnHoverProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const shouldAnimate = useCallback(() => {
    if (textRef.current && containerRef.current && !disabled) {
      // Force a layout recalculation
      textRef.current.style.width = "auto";
      textRef.current.style.display = "inline-block";

      const textWidth =
        textRef.current.scrollWidth || textRef.current.offsetWidth;
      const containerWidth = containerRef.current.clientWidth;
      const overflows = textWidth > containerWidth;

      return overflows;
    }
    return false;
  }, [disabled]);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (shouldAnimate() && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const textWidth = e.currentTarget.scrollWidth;
        const overflowAmount = textWidth - containerWidth;

        e.currentTarget.style.setProperty(
          "--overflow-amount",
          `${overflowAmount}px`
        );
        e.currentTarget.style.animation = `scroll-text ${duration}s forwards`;
      }
    },
    [shouldAnimate, duration]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (shouldAnimate()) {
        // Reset to beginning position when mouse leaves
        e.currentTarget.style.animation = "none";
        e.currentTarget.style.transform = "translateX(0)";
      }
    },
    [shouldAnimate]
  );

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden", containerClassName)}
    >
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        ref={textRef}
        className={cn("inline-block whitespace-nowrap", className)}
      >
        {children}
      </span>
    </div>
  );
}
