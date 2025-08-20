"use client";

import { ArrowRight } from "lucide-react";

import { useDevMode } from "@/providers/DevModeProvider";

import { Button } from "../ui/button";

export const UnsupportedContent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { setPanelOpen } = useDevMode();

  const handleToggleDevMode = () => {
    setPanelOpen(true);
  };

  return (
    <div className="border-l-1 min-h-13 relative mb-4 block w-full overflow-hidden !whitespace-pre-wrap rounded-r-xl border-gray-800 bg-gray-300/50 p-3">
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
        <Button
          onClick={handleToggleDevMode}
          variant="outline"
          size="sm"
          className="w-fit bg-transparent hover:bg-gray-500/80"
        >
          Edit in dev mode <ArrowRight className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  );
};
