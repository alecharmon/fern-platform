import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./button";
import { Input } from "./input";

type CopyableTextProps = {
    text: string;
    successMessage?: string;
    variant?: "default" | "innerCopy";
};

export function CopyableText({ text, successMessage, variant = "default" }: CopyableTextProps) {
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
            <Input value={text} readOnly className="flex-1" />
            <Button variant="outline" onClick={() => void copyToClipboard()}>
                {copied ? <CheckIcon className="text-primary size-4" /> : <CopyIcon className="size-4" />}
            </Button>
        </div>
    ) : (
        <div className="relative flex items-center">
            <Input value={text} readOnly className="flex-1 pr-10" />
            <button
                type="button"
                onClick={() => void copyToClipboard()}
                className="absolute right-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            >
                {copied ? <CheckIcon className="text-primary size-4" /> : <CopyIcon className="size-4" />}
            </button>
        </div>
    );
}
