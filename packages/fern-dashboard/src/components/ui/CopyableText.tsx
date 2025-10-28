import { CheckIcon, ClipboardIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./button";
import { Input } from "./input";

type CopyableTextProps = {
    text: string;
    successMessage?: string;
};

export function CopyableText({ text, successMessage }: CopyableTextProps) {
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

    return (
        <div className="flex items-center space-x-2">
            <Input value={text} readOnly className="flex-1" />
            <Button variant="outline" onClick={() => void copyToClipboard()}>
                {copied ? <CheckIcon className="text-primary size-4" /> : <ClipboardIcon className="size-4" />}
            </Button>
        </div>
    );
}
