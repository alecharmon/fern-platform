import { Construction } from "lucide-react";
import { cn } from "@/utils/utils";

export default function ComingSoonPage({
    className,
    text,
    backgroundImage
}: {
    className?: string;
    text: string;
    backgroundImage: string;
}) {
    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <div
                className="absolute inset-0 blur-xs top-12"
                style={{
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat"
                }}
            />
            <div className="relative flex items-center justify-center gap-4 rounded-lg bg-background border border-[--fern-border] p-2 px-4 text-muted-foreground shadow-lg">
                <Construction className="size-6" />
                <p className="font-medium">{text}</p>
            </div>
        </div>
    );
}
