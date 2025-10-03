import Card from "../../ui/card";
import { VEPreviewImage } from "../VEPreviewImage";
import { VisualEditorHeader } from "./VisualEditorHeader";

export function VisualEditorEmptyCard({ children }: { children: React.ReactNode }) {
    return (
        <Card className="relative flex h-[300px] flex-col-reverse gap-0 !p-0 lg:flex-row">
            <div className="lg:max-w-1/2 h-full w-full">
                <VEPreviewImage className="h-full w-full" />
            </div>
            <div className="flex flex-col items-center justify-center gap-4 p-6 md:flex-1 lg:items-start">
                <div className="flex flex-col items-center lg:items-start">
                    <VisualEditorHeader />
                    <p className="text-muted-foreground text-sm">Modify your documentation without touching code.</p>
                </div>
                {children}
            </div>
        </Card>
    );
}
