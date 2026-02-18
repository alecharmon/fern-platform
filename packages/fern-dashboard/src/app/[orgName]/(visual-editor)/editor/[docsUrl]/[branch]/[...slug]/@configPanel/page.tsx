"use client";

import { X } from "lucide-react";
import { PanelShell } from "@/components/editor/PanelShell";
import { ThemingConfigurationSidebar } from "@/components/editor/ThemingConfigurationSidebar";
import { Button } from "@/components/ui/button";
import { useThemingPanel } from "@/providers/ThemingPanelProvider";

export default function ConfigPanel() {
    const { isThemingPanelOpen, setThemingPanelOpen } = useThemingPanel();

    if (!isThemingPanelOpen) {
        return null;
    }

    return (
        <PanelShell
            header={
                <div className="flex items-center justify-center pt-4 pb-2 px-1 relative">
                    <h3 className="text-sm font-medium">Docs Settings</h3>
                    <Button
                        variant="ghost"
                        size="iconSm"
                        className="absolute right-1"
                        onClick={() => setThemingPanelOpen(false)}
                    >
                        <X className="size-4" />
                    </Button>
                </div>
            }
        >
            <ThemingConfigurationSidebar />
        </PanelShell>
    );
}
