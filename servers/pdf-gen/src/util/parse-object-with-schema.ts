import type { z } from "zod";

export function parseObjectWithSchema<T>(data: unknown, schema: z.Schema<T>, identifier: string) {
    const parseRes = schema.safeParse(data);

    if (!parseRes.success) {
        const { error } = parseRes;
        const issue = error.issues[0];
        if (issue) {
            const { message } = issue;
            const path = issue.path.join(".");
            throw new Error(`Invalid value in ${identifier} for '${path}': ${message}`);
        } else {
            throw new Error("An unexpected invalid value.");
        }
    }

    return parseRes.data;
}
