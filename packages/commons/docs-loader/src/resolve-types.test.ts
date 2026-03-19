import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import type { TypeId } from "@fern-api/fdr-sdk/navigation";
import { describe, expect, it, vi } from "vitest";

import { type GetApiById, type ResolveTypesInput, resolveTypes } from "./resolve-types";

function makeType(name: string): TypeDefinition {
    return {
        name,
        shape: { type: "object", extends: [], properties: [], extraProperties: undefined },
        description: undefined,
        availability: undefined
    } as unknown as TypeDefinition;
}

function makeGetApiById(apis: Record<string, { types?: Record<TypeId, TypeDefinition> }>): GetApiById {
    return vi.fn(async (id: string) => {
        const api = apis[id];
        if (!api) {
            throw new Error(`API ${id} not found`);
        }
        return {
            id,
            endpoints: {},
            types: api.types ?? {},
            webhooks: {},
            websockets: {},
            subpackages: {},
            globalHeaders: [],
            auth: undefined
        } as unknown as ApiDefinition.ApiDefinition;
    });
}

describe("resolveTypes", () => {
    describe("with apiName specified", () => {
        it("resolves types via apiNameToId lookup", async () => {
            const plantType = makeType("Plant");
            const getApiById = makeGetApiById({
                "def-1": { types: { "type:plant": plantType } as Record<TypeId, TypeDefinition> }
            });

            const input: ResolveTypesInput = {
                apiNameToId: { plants: "def-1" }
            };

            const result = await resolveTypes(input, "plants", getApiById);
            expect(result).toEqual({ "type:plant": plantType });
            expect(getApiById).toHaveBeenCalledWith("def-1");
        });

        it("returns empty when apiName is not in apiNameToId", async () => {
            const getApiById = makeGetApiById({});

            const input: ResolveTypesInput = {
                apiNameToId: { other: "def-1" }
            };

            const result = await resolveTypes(input, "plants", getApiById);
            expect(result).toEqual({});
            expect(getApiById).not.toHaveBeenCalled();
        });

        it("returns empty when apiNameToId is null", async () => {
            const getApiById = makeGetApiById({});

            const input: ResolveTypesInput = {
                apiNameToId: null
            };

            const result = await resolveTypes(input, "plants", getApiById);
            expect(result).toEqual({});
            expect(getApiById).not.toHaveBeenCalled();
        });

        it("returns empty when apiNameToId is undefined", async () => {
            const getApiById = makeGetApiById({});

            const input: ResolveTypesInput = {
                apiNameToId: undefined
            };

            const result = await resolveTypes(input, "plants", getApiById);
            expect(result).toEqual({});
            expect(getApiById).not.toHaveBeenCalled();
        });

        it("handles API with no types field", async () => {
            const getApiById = makeGetApiById({
                "def-1": { types: undefined }
            });

            const input: ResolveTypesInput = {
                apiNameToId: { plants: "def-1" }
            };

            const result = await resolveTypes(input, "plants", getApiById);
            expect(result).toEqual({});
        });
    });

    describe("without apiName (all APIs)", () => {
        it("fetches types from all APIs in apiNameToId", async () => {
            const plantType = makeType("Plant");
            const animalType = makeType("Animal");
            const getApiById = makeGetApiById({
                "def-1": { types: { "type:plant": plantType } as Record<TypeId, TypeDefinition> },
                "def-2": { types: { "type:animal": animalType } as Record<TypeId, TypeDefinition> }
            });

            const input: ResolveTypesInput = {
                apiNameToId: { plants: "def-1", animals: "def-2" }
            };

            const result = await resolveTypes(input, undefined, getApiById);
            expect(result).toEqual({
                "type:plant": plantType,
                "type:animal": animalType
            });
            expect(getApiById).toHaveBeenCalledTimes(2);
        });

        it("returns empty when apiNameToId is null", async () => {
            const getApiById = makeGetApiById({});

            const input: ResolveTypesInput = {
                apiNameToId: null
            };

            const result = await resolveTypes(input, undefined, getApiById);
            expect(result).toEqual({});
            expect(getApiById).not.toHaveBeenCalled();
        });

        it("returns empty when apiNameToId is empty", async () => {
            const getApiById = makeGetApiById({});

            const input: ResolveTypesInput = {
                apiNameToId: {}
            };

            const result = await resolveTypes(input, undefined, getApiById);
            expect(result).toEqual({});
            expect(getApiById).not.toHaveBeenCalled();
        });

        it("merges types from multiple APIs", async () => {
            const plantType = makeType("Plant");
            const seedType = makeType("Seed");
            const animalType = makeType("Animal");
            const getApiById = makeGetApiById({
                "def-1": {
                    types: { "type:plant": plantType, "type:seed": seedType } as Record<TypeId, TypeDefinition>
                },
                "def-2": {
                    types: { "type:animal": animalType } as Record<TypeId, TypeDefinition>
                }
            });

            const input: ResolveTypesInput = {
                apiNameToId: { plants: "def-1", animals: "def-2" }
            };

            const result = await resolveTypes(input, undefined, getApiById);
            expect(result["type:plant" as TypeId]).toBe(plantType);
            expect(result["type:seed" as TypeId]).toBe(seedType);
            expect(result["type:animal" as TypeId]).toBe(animalType);
        });
    });

    describe("name mismatch scenario (core bug)", () => {
        it("resolves types using the apiNameToId key, not the inline apiName", async () => {
            // Core bug scenario: the apiNameToId key is "signalwire-swml"
            // but the apiName inside the API definition blob is "swml".
            // The Schema component must use the apiNameToId key.
            const types = {
                "type:data-map": makeType("DataMap"),
                "type:output": makeType("Output")
            } as Record<TypeId, TypeDefinition>;

            const getApiById = makeGetApiById({
                "def-swml": { types }
            });

            const input: ResolveTypesInput = {
                apiNameToId: { "signalwire-swml": "def-swml" }
            };

            const result = await resolveTypes(input, "signalwire-swml", getApiById);
            expect(Object.keys(result)).toHaveLength(2);
            expect(result).toHaveProperty("type:data-map");
            expect(result).toHaveProperty("type:output");
        });

        it("returns empty when using inline apiName that differs from apiNameToId key", async () => {
            const getApiById = makeGetApiById({});

            const input: ResolveTypesInput = {
                apiNameToId: { "signalwire-swml": "def-swml" }
            };

            // "swml" is the inline apiName but not the apiNameToId key
            const result = await resolveTypes(input, "swml", getApiById);
            expect(result).toEqual({});
            expect(getApiById).not.toHaveBeenCalled();
        });
    });
});
