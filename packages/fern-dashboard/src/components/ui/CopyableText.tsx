import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/utils/utils";
import { Button } from "./button";
import { Input } from "./input";

type CopyableTextProps = {
    text: string;
    successMessage?: string;
    variant?: "default" | "innerCopy";
    /**
     * Custom className to apply to the input element
     */
    className?: string;
};

export function CopyableText({ text, successMessage, variant = "default", className }: CopyableTextProps) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
        if (text) {
            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                // Reset copied state after 4 seconds so we re-show the copy icon
                setTimeout(() => {
                    setCopied(false);
                }, 4000);

                toast.success(successMessage || "Copied to clipboard!");
            } catch (error) {
                console.error("Unable to copy text:", error);
                setCopied(false);
                toast.warning("Unable to copy text. Please check your browser settings to ensure copying is enabled.");
            }
        } else {
            toast.warning("No text to copy!");
        }
    };

    return variant === "default" ? (
        <div className="flex items-center space-x-2">
            <Input value={text} readOnly className={cn("flex-1", className)} />
            <Button variant="outline" onClick={() => void copyToClipboard()}>
                {copied ? <CheckIcon className="text-primary size-4" /> : <CopyIcon className="size-4" />}
            </Button>
        </div>
    ) : (
        <div className={cn("group relative inline-flex items-center w-auto hover:opacity-100")}>
            <Input
                value={text}
                readOnly
                size={text.length}
                className={cn("pr-10 w-auto min-w-0", className)}
                style={{ width: `${text.length * 0.6}ch` }}
            />
            <button
                type="button"
                onClick={() => void copyToClipboard()}
                className={cn(
                    "absolute right-1 px-1.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors bg-background opacity-0 group-hover:opacity-100"
                )}
            >
                {copied ? <CheckIcon className="text-primary size-4" /> : <CopyIcon className="size-4" />}
            </button>
        </div>
    );
}
