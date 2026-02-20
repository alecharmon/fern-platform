import { os } from "@orpc/server";

import { PythonLibraryDocsIRSchema } from "./python";

export function createLibraryDocsIRRouter() {
    const uploadPythonLibraryDocsIR = os
        .route({ method: "POST", path: "/python" })
        .input(PythonLibraryDocsIRSchema)
        .output(PythonLibraryDocsIRSchema)
        .handler(async ({ input }) => {
            return input;
        });

    return { uploadPythonLibraryDocsIR };
}
