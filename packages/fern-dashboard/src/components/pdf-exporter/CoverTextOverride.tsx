import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/utils/utils";

export interface CoverTextOverrideProps {
    value: string | null | undefined;
    onChange: (value: string | null | undefined) => void;
}

export function CoverTextOverride({ value, onChange }: CoverTextOverrideProps) {
    const isHidden = value === "";
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-1100">Hide this text</div>
                <Switch checked={isHidden} onCheckedChange={(checked) => onChange(checked ? "" : null)} />
            </div>
            <div className={cn("flex flex-col gap-2", isHidden && "opacity-60")}>
                <Label className="text-sm font-medium text-gray-1100">Custom text</Label>
                <Input
                    disabled={isHidden}
                    value={typeof value === "string" && value !== "" ? value : ""}
                    onChange={(e) => onChange(e.target.value.length === 0 ? null : e.target.value)}
                    placeholder="e.g. API Reference"
                />
            </div>
        </div>
    );
}
