import { BetaBadge } from "../BetaBadge";

export function VisualEditorHeader({ rightContent }: { rightContent?: React.ReactNode }) {
    return (
        <div className="flex items-center lg:items-start justify-center lg:justify-between gap-4 flex-col lg:flex-row">
            <div className="flex flex-col text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-2 text-lg font-semibold">
                    Fern Editor
                    <BetaBadge />
                </div>
                <p className="text-muted-foreground text-sm">Edit your docs in the browser.</p>
            </div>
            <div className="lg:max-w-1/2 max-w-[400px] w-fit">{rightContent}</div>
        </div>
    );
}
