"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "../ui/input";

export declare namespace LinkPopover {
    export interface Props {
        editor: Editor;
        onClose: () => void;
    }
}

export function LinkPopover({ editor, onClose }: LinkPopover.Props) {
    const [url, setUrl] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        // Get the current link URL if we're editing an existing link
        const { href } = editor.getAttributes("link");
        if (href) {
            setUrl(href);
            setIsEditing(true);
        }
    }, [editor]);

    const handleSetLink = useCallback(() => {
        if (!url) {
            // Remove link if URL is empty
            editor.chain().focus().unsetLink().run();
            onClose();
            return;
        }

        const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url);

        // Add https:// if no protocol is specified
        const finalUrl = hasProtocol ? url : `https://${url}`;

        editor.chain().focus().setLink({ href: finalUrl }).run();
        onClose();
    }, [editor, url, onClose]);

    const handleRemoveLink = useCallback(() => {
        editor.chain().focus().unsetLink().run();
        onClose();
    }, [editor, onClose]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSetLink();
            } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        },
        [handleSetLink, onClose]
    );

    return (
        <div className="flex min-w-[300px] flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
                <Input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter URL"
                    className="border-1 rounded-1 flex-1 border-gray-400 px-2 py-1 text-sm focus:border-blue-600 focus:outline-none"
                    autoFocus
                />
            </div>
            <div className="flex items-center justify-between gap-2">
                {isEditing && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveLink} className="hover:text-red-500">
                        <Icon variant="Trash2" size={16} />
                    </Button>
                )}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSetLink}>
                        {isEditing ? "Update" : "Add"} Link
                    </Button>
                </div>
            </div>
        </div>
    );
}
