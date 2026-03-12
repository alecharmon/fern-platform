import { beforeEach, describe, expect, it, vi } from "vitest";
import { blobUrlToBase64, fileToBase64 } from "../file-utils";

describe("fileToBase64", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should convert a File to base64 string", async () => {
        const mockBase64 = "dGVzdA==";
        const mockDataUrl = `data:text/plain;base64,${mockBase64}`;

        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as (() => void) | null,
            onerror: null as ((err: unknown) => void) | null,
            result: mockDataUrl
        };

        vi.spyOn(globalThis, "FileReader").mockImplementation(() => mockFileReader as unknown as FileReader);

        const file = new File(["test"], "test.txt", { type: "text/plain" });

        const promise = fileToBase64(file);

        // Trigger the onload callback
        mockFileReader.onload?.();

        const result = await promise;
        expect(result).toBe(mockBase64);
        expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(file);
    });

    it("should return empty string when base64 part is missing", async () => {
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as (() => void) | null,
            onerror: null as ((err: unknown) => void) | null,
            result: "data:text/plain;base64,"
        };

        vi.spyOn(globalThis, "FileReader").mockImplementation(() => mockFileReader as unknown as FileReader);

        const file = new File([""], "empty.txt", { type: "text/plain" });

        const promise = fileToBase64(file);
        mockFileReader.onload?.();

        const result = await promise;
        expect(result).toBe("");
    });

    it("should reject on FileReader error", async () => {
        const mockError = new Error("Read failed");
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as (() => void) | null,
            onerror: null as ((err: unknown) => void) | null,
            result: null
        };

        vi.spyOn(globalThis, "FileReader").mockImplementation(() => mockFileReader as unknown as FileReader);

        const file = new File(["test"], "test.txt", { type: "text/plain" });

        const promise = fileToBase64(file);
        mockFileReader.onerror?.(mockError);

        await expect(promise).rejects.toEqual(mockError);
    });
});

describe("blobUrlToBase64", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should fetch a blob URL and return base64 data", async () => {
        const mockBase64 = "aW1hZ2VkYXRh";
        const mockDataUrl = `data:image/png;base64,${mockBase64}`;
        const mockBlob = new Blob(["imagedata"], { type: "image/png" });

        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            blob: () => Promise.resolve(mockBlob)
        } as Response);

        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as (() => void) | null,
            onerror: null as ((err: unknown) => void) | null,
            result: mockDataUrl
        };

        vi.spyOn(globalThis, "FileReader").mockImplementation(() => mockFileReader as unknown as FileReader);

        const promise = blobUrlToBase64("blob:http://localhost/abc123");

        // Wait for fetch to resolve before triggering onload
        await vi.waitFor(() => {
            expect(mockFileReader.readAsDataURL).toHaveBeenCalled();
        });

        mockFileReader.onload?.();

        const result = await promise;
        expect(result).toBe(mockBase64);
        expect(globalThis.fetch).toHaveBeenCalledWith("blob:http://localhost/abc123");
    });
});
