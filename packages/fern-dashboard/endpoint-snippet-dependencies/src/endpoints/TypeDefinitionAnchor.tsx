"use client";

import React from "react";

import { cn } from "@fern-docs/components";
import { isomorphicRequestIdleCallback } from "@fern-ui/react-commons";

import {
  useHref,
  useIsActive,
  useTypeDefinitionContext,
} from "../type-definitions/TypeDefinitionContext";

export interface TypeDefinitionAnchorProps {
  children: React.ReactNode;
  sideOffset?: number;
  FernAnchor: React.ComponentType<{
    href: string;
    sideOffset?: number;
    asChild?: boolean;
    children: React.ReactNode;
  }>;
}

export function TypeDefinitionAnchor({
  children,
  sideOffset,
  FernAnchor,
}: TypeDefinitionAnchorProps) {
  const href = useHref();
  return (
    <FernAnchor href={href} sideOffset={sideOffset} asChild>
      <div className="inline-flex items-baseline gap-2">{children}</div>
    </FernAnchor>
  );
}

export const SectionContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ children, ...props }, ref) => {
  const href = useHref();
  return (
    <div
      id={href}
      ref={ref}
      {...props}
      className={cn("relative", props.className)}
    >
      {children}
    </div>
  );
});

SectionContainer.displayName = "SectionContainer";

export interface PropertyContainerProps {
  children: React.ReactNode;
}

export function PropertyContainer({
  children,
  ...props
}: PropertyContainerProps & React.ComponentProps<"div">) {
  const { collapsible } = useTypeDefinitionContext();
  const isActive = useIsActive();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (isActive) {
      isomorphicRequestIdleCallback(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [isActive]);
  return (
    <SectionContainer
      ref={ref}
      {...props}
      className={cn(
        "m-3 space-y-3",
        { "mx-0": !collapsible },
        props.className,
        {
          "before:bg-(color:--accent-a3) before:rounded-1 before:absolute before:-inset-2 before:z-[-1] before:content-['']":
            isActive,
        }
      )}
    >
      {children}
    </SectionContainer>
  );
}
