import { os } from "@orpc/server";
import * as z from "zod";

import type { PythonLibraryDocsIRSchema } from "./python";

export function createLibraryDocsIRRouter() {
    const uploadPythonLibraryDocsIR = os
        .route({ method: "POST", path: "/python" })
        .input(z.custom<z.infer<typeof PythonLibraryDocsIRSchema>>())
        .output(z.custom<z.infer<typeof PythonLibraryDocsIRSchema>>())
        .handler(async ({ input }) => {
            return input;
        });

    return { uploadPythonLibraryDocsIR };
}
