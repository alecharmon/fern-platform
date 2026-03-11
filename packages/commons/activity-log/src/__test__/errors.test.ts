import { describe, expect, it } from "vitest";
import { activityLogError } from "../errors.js";

describe("activityLogError", () => {
    it("creates an error with source activity-log", () => {
        const err = activityLogError("QUERY_FAILED", "something broke");
        expect(err.source).toBe("activity-log");
        expect(err.code).toBe("QUERY_FAILED");
        expect(err.message).toBe("something broke");
        expect(err.cause).toBeUndefined();
    });

    it("includes cause when provided", () => {
        const cause = new Error("underlying");
        const err = activityLogError("INSERT_FAILED", "insert broke", cause);
        expect(err.cause).toBe(cause);
    });
});
