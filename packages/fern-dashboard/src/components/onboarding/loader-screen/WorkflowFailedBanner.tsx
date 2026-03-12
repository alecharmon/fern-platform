"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../ui/button";

interface WorkflowFailedBannerProps {
    githubActionsUrl: string | undefined;
    isRetrying: boolean;
    onRetry: () => void;
}

export function WorkflowFailedBanner({ githubActionsUrl, isRetrying, onRetry }: WorkflowFailedBannerProps) {
    return (
        <div className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 w-full max-w-3xl rounded-lg border p-4">
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">Docs publishing failed</p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                            The GitHub Action failed to publish your docs. This may be due to a temporary issue with the
                            FERN_TOKEN.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {githubActionsUrl && (
                            <Button variant="outline" size="sm" asChild>
                                <a href={githubActionsUrl} target="_blank" rel="noopener noreferrer">
                                    View GitHub Action
                                </a>
                            </Button>
                        )}
                        <Button size="sm" onClick={onRetry} disabled={isRetrying}>
                            {isRetrying ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Retrying...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Reset token and retry
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
