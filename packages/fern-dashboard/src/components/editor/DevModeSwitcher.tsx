import { Code2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useDevMode } from "@/providers/DevModeProvider";
import { cn } from "@/utils/utils";

export const DevModeSwitcher = () => {
    const { panelOpen, setPanelOpen } = useDevMode();
    return (
        <Switch
            checked={panelOpen}
            onCheckedChange={setPanelOpen}
            thumbContent={
                <div className="flex items-center justify-center">
                    <Code2 className={cn("size-4", panelOpen ? "text-primary" : "text-muted-foreground")} />
                </div>
            }
        />
    );
};
