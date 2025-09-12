"use client";

import { Menu, X } from "lucide-react";

import { Button } from "..";
import { cn } from "../cn";
import { useIsDismissableSidebarOpen } from "../state/mobile";

export function MobileMenuButton({ className }: { className?: string }) {
  const [open, setOpen] = useIsDismissableSidebarOpen();
  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={() => setOpen((prev) => !prev)}
      variant={open ? "default" : "ghost"}
      size="icon"
    >
      {open ? <X /> : <Menu />}
    </Button>
  );
}
