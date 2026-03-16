"use client";

/**
 * Full-screen loading overlay with a spinner and optional message.
 */
export function FullScreenLoader({ message }: { message?: string }) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
    );
}
