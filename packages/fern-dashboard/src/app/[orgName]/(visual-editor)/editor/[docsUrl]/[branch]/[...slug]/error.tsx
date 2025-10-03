"use client";

import { UnsupportedContent } from "@/components/editor/UnsupportedContent";

export default function Error({ error: _error }: { error: Error }) {
    // TODO: We should make this error message more specific to the error thrown. Right now this
    // is a catch-all for any error that occurs in the editor's markdown page.
    return (
        <div className="w-content-width mx-auto mt-12">
            <div>
                <UnsupportedContent>
                    This file contains markdown that is not yet readable by the editor.
                </UnsupportedContent>
            </div>
        </div>
    );
}
