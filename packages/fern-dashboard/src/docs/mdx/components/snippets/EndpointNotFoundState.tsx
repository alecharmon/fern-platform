import { Info, TriangleAlert } from "lucide-react";

import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import { EditorComponentPopoverButton } from "@/components/editor/editor-component/EditorComponentPopover";

interface EndpointNotFoundStateProps {
  endpointProp?: string;
  snippetRef: React.RefObject<HTMLDivElement | null>;
}

export function EndpointNotFoundState({
  endpointProp,
  snippetRef,
}: EndpointNotFoundStateProps) {
  const { isWithinEditor } = useEditorComponent();
  const isEmpty = !endpointProp || endpointProp.trim() === "";

  if (isEmpty) {
    // Neutral empty state - encourage configuration
    return (
      <div ref={snippetRef} className="relative">
        <div className="bg-card-background border-card-border rounded-3 shadow-card-grayscale relative flex flex-col overflow-hidden border">
          {isWithinEditor && (
            <EditorComponentPopoverButton className="absolute right-2 top-2 z-10" />
          )}
          <div className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Configure endpoint
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Specify an endpoint to display a code snippet (e.g.,{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">
                  GET /users
                </code>
                )
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state - endpoint specified but not found
  return (
    <div ref={snippetRef} className="relative">
      <div className="bg-card-background border-card-border rounded-3 shadow-card-grayscale relative flex flex-col overflow-hidden border">
        {isWithinEditor && (
          <EditorComponentPopoverButton className="absolute right-2 top-2 z-10" />
        )}
        <div className="flex items-start gap-3 p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-red-900 dark:text-red-100">
              Endpoint not found
            </div>
            <div className="mt-1 text-sm text-red-700 dark:text-red-300">
              The endpoint{" "}
              <code className="rounded bg-red-100 px-1 py-0.5 dark:bg-red-900/50">
                {endpointProp}
              </code>{" "}
              could not be found in your API definition.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
