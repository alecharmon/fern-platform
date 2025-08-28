import { ReactNode, memo } from "react";

import { Kbd } from "@fern-docs/components";
import { cn } from "@fern-docs/components";

export const CommandKbd = memo(({ className }: { className?: string }) => {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Kbd>{"⌘"}</Kbd>
    </span>
  );
});

export const ForwardSlashKbd = memo(({ className }: { className?: string }) => {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Kbd>{"/"}</Kbd>
    </span>
  );
});
