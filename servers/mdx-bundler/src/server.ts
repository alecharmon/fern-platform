import cors from "cors";
import express, { type Request, type Response } from "express";

import { serializeTwoslash } from "./serialize.js";

const app = express();

app.use(cors());
app.use(express.json());

const asyncHandler =
    (fn: (req: Request, res: Response, next: (err?: unknown) => void) => Promise<unknown>) =>
    (req: Request, res: Response, next: (err?: unknown) => void) => {
        void Promise.resolve(fn(req, res, next)).catch(next);
    };

app.get("/health", (_req: Request, res: Response) => {
    res.sendStatus(200);
});

app.post(
    "/serialize",
    asyncHandler(async (req: Request, res: Response) => {
        if (!req.body.code) {
            res.status(400).json({ error: "No code provided" });
            return;
        }

        try {
            const result = await serializeTwoslash(req.body.code);
            if (!result) {
                res.status(400).json({ error: "Failed to serialize MDX" });
                return;
            }
            res.json(result);
        } catch (error: unknown) {
            console.error("Error serializing MDX:", error);
            res.status(500).json({ error: "Failed to serialize MDX" });
        }
    })
);

app.listen(8080);
