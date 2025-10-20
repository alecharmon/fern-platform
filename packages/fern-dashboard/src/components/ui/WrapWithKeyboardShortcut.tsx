"use client";

import { type ReactNode, useEffect } from "react";

export interface WrapWithKeyboardShortcutProps {
    /**
     * The keyboard shortcut to listen for (e.g., "o", "k", "s", etc.)
     * Will automatically work with Cmd on Mac and Ctrl on Windows/Linux
     */
    shortcut: string;
    /**
     * The children to render
     */
    children: ReactNode;
    /**
     * Callback when the keyboard shortcut is triggered
     */
    onShortcut: () => void;
    /**
     * Whether the keyboard shortcut is disabled
     * @default false
     */
    disabled?: boolean;
    /**
     * Whether to prevent the default browser behavior when the shortcut is triggered
     * @default true
     */
    preventDefault?: boolean;
}

/**
 * Wraps children with a global keyboard shortcut listener.
 * Automatically handles Cmd (Mac) / Ctrl (Windows/Linux) modifier.
 *
 * @example Basic usage - Open a dialog with Cmd+K
 * ```tsx
 * <WrapWithKeyboardShortcut shortcut="k" onShortcut={() => setDialogOpen(true)}>
 *   <SearchDialog open={dialogOpen} onOpenChange={setDialogOpen} />
 * </WrapWithKeyboardShortcut>
 * ```
 *
 * @example With a ref callback
 * ```tsx
 * const componentRef = useRef<ComponentRef>(null);
 *
 * <WrapWithKeyboardShortcut
 *   shortcut="s"
 *   onShortcut={() => componentRef.current?.save()}
 * >
 *   <MyComponent ref={componentRef} />
 * </WrapWithKeyboardShortcut>
 * ```
 *
 * @example Conditionally disabled
 * ```tsx
 * <WrapWithKeyboardShortcut
 *   shortcut="d"
 *   onShortcut={() => deleteItem()}
 *   disabled={!hasPermission}
 * >
 *   <DeleteButton />
 * </WrapWithKeyboardShortcut>
 * ```
 */
export function WrapWithKeyboardShortcut({
    shortcut,
    children,
    onShortcut,
    disabled = false,
    preventDefault = true
}: WrapWithKeyboardShortcutProps) {
    useEffect(() => {
        if (disabled) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Cmd (Mac) or Ctrl (Windows/Linux) + the specified key
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcut.toLowerCase()) {
                if (preventDefault) {
                    e.preventDefault();
                }
                onShortcut();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [shortcut, onShortcut, disabled, preventDefault]);

    return <>{children}</>;
}
