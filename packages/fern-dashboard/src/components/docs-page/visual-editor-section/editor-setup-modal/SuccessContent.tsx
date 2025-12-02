import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Note } from "../../Note";

export function SuccessContent({ showRefreshButton }: { showRefreshButton?: boolean }) {
    const [loading, setLoading] = useState(false);

    const handleStartNewSession = () => {
        setLoading(true);
        window.location.reload();
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>Success!</DialogTitle>
                <DialogDescription />
            </DialogHeader>
            <DialogBody>
                {showRefreshButton ? (
                    <>
                        <p className="text-muted-foreground text-sm">
                            Click the button below to start a new Fern Editor session.
                        </p>
                        <Button variant="default" onClick={handleStartNewSession} loading={loading}>
                            <RotateCcwIcon className="size-4" />
                            Start new session
                        </Button>
                    </>
                ) : (
                    <Note variant="bold">Repo successfully validated!</Note>
                )}
            </DialogBody>
        </>
    );
}
