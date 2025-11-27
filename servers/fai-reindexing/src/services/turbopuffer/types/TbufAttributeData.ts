import { z } from "zod";

export const TbufAttributeDataSchema = z.union([
    z.string(), // string
    z
        .number()
        .positive()
        .int(), // uint
    z
        .string()
        .uuid(), // uuid
    z.boolean(), // bool
    z.array(z.string()), // []string
    z.array(z.number().positive().int()), // []uint
    z.array(z.string().uuid()) // []uuid
]);

export type TbufAttributeData = z.infer<typeof TbufAttributeDataSchema>;
