"use client";

import { useDispatchSidebarAction } from "@/state/navigation";

import { FernLink } from "./FernLink";

export function FernLinkTab({
  children,
  ...props
}: React.ComponentProps<typeof FernLink>) {
  const dispatch = useDispatchSidebarAction();
  return (
    <FernLink
      {...props}
      onClick={() => {
        dispatch({ type: "collapse-all" });
      }}
    >
      {children}
    </FernLink>
  );
}
