import { BetaBadge } from "../BetaBadge";

export function VisualEditorHeader({ rightContent }: { rightContent?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-center md:justify-between gap-4 flex-col md:flex-row">
            <div className="flex flex-col text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 text-lg font-semibold">
                    Fern Editor
                    <BetaBadge />
                </div>
                <p className="text-muted-foreground text-sm">Modify your documentation without touching code.</p>
            </div>
            {rightContent}
        </div>
    );
}
