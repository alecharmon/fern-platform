import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

import { serializeTwoslash } from "./serialize";

function deterministic(str: string | undefined): string | undefined {
    return str?.replaceAll(
        /[0-9a-f]{8}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{12}/gi,
        "_random_uuid_"
    );
}

vi.mock("server-only", () => ({}));

it("should serialize twoslash-alchemy.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-alchemy.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(
        join(__dirname, "__snapshots__", "twoslash-alchemy.js")
    );
}, 30000);

it("should serialize twoslash-cut.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-cut.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(join(__dirname, "__snapshots__", "twoslash-cut.js"));
}, 20000);

it("should serialize twoslash-emit.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-emit.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(join(__dirname, "__snapshots__", "twoslash-emit.js"));
});

it("should serialize twoslash-implicit.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-implicit.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(
        join(__dirname, "__snapshots__", "twoslash-implicit.js")
    );
});

it("should serialize twoslash-mode.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-mode.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(join(__dirname, "__snapshots__", "twoslash-mode.js"));
});

it("should serialize twoslash-more-simple.mdx", async () => {
    const result = await serializeTwoslash(
        readFileSync(join(__dirname, "fixtures", "twoslash-more-simple.mdx"), "utf-8")
    );
    await expect(deterministic(result?.code)).toMatchFileSnapshot(
        join(__dirname, "__snapshots__", "twoslash-more-simple.js")
    );
});

it("should serialize twoslash-react.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-react.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(
        join(__dirname, "__snapshots__", "twoslash-react.js")
    );
});

it("should serialize twoslash-simp.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-simp.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(join(__dirname, "__snapshots__", "twoslash-simp.js"));
});

it("should serialize twoslash-simple.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-simple.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(
        join(__dirname, "__snapshots__", "twoslash-simple.js")
    );
});

it("should serialize twoslash.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(join(__dirname, "__snapshots__", "twoslash.js"));
});

it("should serialize twoslash-js.mdx", async () => {
    const result = await serializeTwoslash(readFileSync(join(__dirname, "fixtures", "twoslash-js.mdx"), "utf-8"));
    await expect(deterministic(result?.code)).toMatchFileSnapshot(join(__dirname, "__snapshots__", "twoslash-js.js"));
});
