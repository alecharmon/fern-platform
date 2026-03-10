import { describe, expect, it } from "vitest";

import { convert } from "../converter.js";
import type { PostmanCollection } from "../postman-types.js";

/**
 * Edge case tests for the postman-to-openapi converter, covering patterns
 * found in real-world Postman collections (deeply nested bodies, mixed types,
 * empty responses, non-JSON bodies, etc.).
 */
describe("postman-to-openapi edge cases", () => {
    describe("deeply nested request bodies with arrays of objects", () => {
        it("handles request body with nested arrays of objects", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Gardens",
                        item: [
                            {
                                name: "Create Garden",
                                request: {
                                    method: "POST",
                                    url: {
                                        raw: "{{baseUrl}}/v2/gardens",
                                        host: ["{{baseUrl}}"],
                                        path: ["v2", "gardens"]
                                    },
                                    header: [{ key: "Content-Type", value: "application/json" }],
                                    body: {
                                        mode: "raw",
                                        raw: JSON.stringify({
                                            beds: [
                                                {
                                                    bed_id: "bed-001",
                                                    plants: [
                                                        {
                                                            id: "plant-001",
                                                            species_url: "https://plants.example.com/species/rosa",
                                                            height_cm: "45.5",
                                                            common_name: "Garden Rose"
                                                        }
                                                    ]
                                                }
                                            ],
                                            idempotency_key: "garden-uuid",
                                            caretaker_assignments: [
                                                {
                                                    caretaker: {
                                                        email: "bob@example.com",
                                                        id: "user-001",
                                                        slack_user_id: "USER123"
                                                    },
                                                    role_id: "role-001"
                                                }
                                            ],
                                            layout: "raised-bed",
                                            name: "Rose Garden",
                                            zone_id: "zone-5b",
                                            visibility: "public"
                                        }),
                                        options: { raw: { language: "json" } }
                                    }
                                },
                                response: [
                                    {
                                        name: "Create Garden",
                                        code: 200,
                                        status: "OK",
                                        header: [{ key: "Content-Type", value: "application/json" }],
                                        body: JSON.stringify({
                                            garden: {
                                                id: "garden-001",
                                                name: "Rose Garden",
                                                layout: "raised-bed",
                                                zone: {
                                                    id: "zone-5b",
                                                    name: "Temperate",
                                                    hardiness_rank: 5
                                                },
                                                status: "planned",
                                                visibility: "public",
                                                created_at: "2021-08-17T13:28:57.801578Z"
                                            }
                                        })
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);
            const postOp = spec.paths["/v2/gardens"]!.post!;

            expect(postOp.requestBody).toBeDefined();
            const bodySchema = postOp.requestBody!.content["application/json"]!.schema!;
            expect(bodySchema.type).toBe("object");

            // Nested arrays of objects: beds[].plants[]
            expect(bodySchema.properties!.beds!.type).toBe("array");
            expect(bodySchema.properties!.beds!.items!.type).toBe("object");
            expect(bodySchema.properties!.beds!.items!.properties!.plants!.type).toBe("array");

            // Nested object inside array (caretaker)
            expect(bodySchema.properties!.caretaker_assignments!.type).toBe("array");
            expect(bodySchema.properties!.caretaker_assignments!.items!.properties!.caretaker!.type).toBe("object");
            expect(
                bodySchema.properties!.caretaker_assignments!.items!.properties!.caretaker!.properties!.email!.format
            ).toBe("email");

            // Response with nested object containing integer and date-time
            const respSchema = postOp.responses["200"]!.content!["application/json"]!.schema!;
            expect(respSchema.properties!.garden!.type).toBe("object");
            expect(respSchema.properties!.garden!.properties!.zone!.properties!.hardiness_rank!.type).toBe("integer");
            expect(respSchema.properties!.garden!.properties!.created_at!.format).toBe("date-time");
        });

        it("handles 5-level deep nesting in request bodies", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Create Planting Plan",
                        request: {
                            method: "POST",
                            url: {
                                raw: "{{baseUrl}}/v2/planting_plans",
                                host: ["{{baseUrl}}"],
                                path: ["v2", "planting_plans"]
                            },
                            body: {
                                mode: "raw",
                                raw: JSON.stringify({
                                    sections: [
                                        {
                                            section_id: "sec-001",
                                            condition_groups: [
                                                {
                                                    conditions: [
                                                        {
                                                            operation: "one_of",
                                                            param_bindings: [
                                                                {
                                                                    array_value: [
                                                                        {
                                                                            literal: "full-sun",
                                                                            reference: "zone.sunlight"
                                                                        }
                                                                    ],
                                                                    value: {
                                                                        literal: "full-sun",
                                                                        reference: "zone.sunlight"
                                                                    }
                                                                }
                                                            ],
                                                            subject: "zone.sunlight"
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ],
                                    name: "Spring planting"
                                }),
                                options: { raw: { language: "json" } }
                            }
                        }
                    }
                ]
            };

            const spec = convert(collection);
            const postOp = spec.paths["/v2/planting_plans"]!.post!;
            const bodySchema = postOp.requestBody!.content["application/json"]!.schema!;

            // Verify 5-level deep: sections[].condition_groups[].conditions[].param_bindings[].array_value[]
            const sections = bodySchema.properties!.sections!;
            expect(sections.type).toBe("array");

            const conditionGroups = sections.items!.properties!.condition_groups!;
            expect(conditionGroups.type).toBe("array");

            const conditions = conditionGroups.items!.properties!.conditions!;
            expect(conditions.type).toBe("array");

            const paramBindings = conditions.items!.properties!.param_bindings!;
            expect(paramBindings.type).toBe("array");

            const arrayValue = paramBindings.items!.properties!.array_value!;
            expect(arrayValue.type).toBe("array");
            expect(arrayValue.items!.properties!.literal!.type).toBe("string");
        });
    });

    describe("boolean and integer query parameter inference", () => {
        it("infers boolean query params from true/false values", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "List Plants",
                        request: {
                            method: "GET",
                            url: {
                                raw: "{{baseUrl}}/v1/plants?garden_id=garden-001&is_perennial=true&growth_habit=vine",
                                host: ["{{baseUrl}}"],
                                path: ["v1", "plants"],
                                query: [
                                    {
                                        key: "garden_id",
                                        value: "garden-001",
                                        description: "Filter by garden ID"
                                    },
                                    {
                                        key: "is_perennial",
                                        value: "true",
                                        description: "Filter for perennial plants"
                                    },
                                    {
                                        key: "growth_habit",
                                        value: "vine",
                                        description: "Filter by growth habit"
                                    }
                                ]
                            }
                        }
                    }
                ]
            };

            const spec = convert(collection);
            const getOp = spec.paths["/v1/plants"]!.get!;

            const isPerennial = getOp.parameters!.find((p) => p.name === "is_perennial");
            expect(isPerennial).toBeDefined();
            expect(isPerennial!.schema!.type).toBe("boolean");
            expect(isPerennial!.description).toBe("Filter for perennial plants");

            const growthHabit = getOp.parameters!.find((p) => p.name === "growth_habit");
            expect(growthHabit!.schema!.type).toBe("string");

            const gardenId = getOp.parameters!.find((p) => p.name === "garden_id");
            expect(gardenId!.schema!.type).toBe("string");
        });

        it("infers integer query params for pagination", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "List Species",
                        request: {
                            method: "GET",
                            url: {
                                raw: "{{baseUrl}}/v1/species?page_size=25&after=cursor-abc",
                                host: ["{{baseUrl}}"],
                                path: ["v1", "species"],
                                query: [
                                    { key: "page_size", value: "25" },
                                    { key: "after", value: "cursor-abc" }
                                ]
                            }
                        }
                    }
                ]
            };

            const spec = convert(collection);
            const getOp = spec.paths["/v1/species"]!.get!;

            const pageSize = getOp.parameters!.find((p) => p.name === "page_size");
            expect(pageSize!.schema!.type).toBe("integer");
            expect(pageSize!.example).toBe("25");

            const after = getOp.parameters!.find((p) => p.name === "after");
            expect(after!.schema!.type).toBe("string");
        });
    });

    describe("path parameters with example values", () => {
        it("converts path variables with example values and descriptions", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Get Plant",
                        request: {
                            method: "GET",
                            url: {
                                raw: "{{baseUrl}}/v1/plants/:plantId",
                                host: ["{{baseUrl}}"],
                                path: ["v1", "plants", ":plantId"],
                                variable: [
                                    {
                                        key: "plantId",
                                        value: "plant-001",
                                        description: "The plant ID"
                                    }
                                ]
                            }
                        },
                        response: [
                            {
                                name: "Get Plant",
                                code: 200,
                                status: "OK",
                                header: [{ key: "Content-Type", value: "application/json" }],
                                body: JSON.stringify({
                                    plant: {
                                        caretaker: {
                                            email: "lisa@example.com",
                                            id: "user-001",
                                            name: "Lisa Green",
                                            role: "gardener",
                                            slack_user_id: "U02AYNF2XJM"
                                        },
                                        planted_at: "2021-08-17T13:28:57.801578Z",
                                        created_at: "2021-08-17T13:28:57.801578Z",
                                        description: "A beautiful climbing rose",
                                        is_perennial: true,
                                        id: "plant-001",
                                        garden_id: "garden-001",
                                        status: "healthy",
                                        updated_at: "2021-08-17T13:28:57.801578Z"
                                    }
                                })
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);
            const getOp = spec.paths["/v1/plants/{plantId}"]!.get!;

            // Path parameter with example and description
            const idParam = getOp.parameters!.find((p) => p.name === "plantId" && p.in === "path");
            expect(idParam).toBeDefined();
            expect(idParam!.required).toBe(true);
            expect(idParam!.example).toBe("plant-001");
            expect(idParam!.description).toBe("The plant ID");

            // Response with mixed types (string, boolean, nested object)
            const respSchema = getOp.responses["200"]!.content!["application/json"]!.schema!;
            expect(respSchema.properties!.plant!.type).toBe("object");
            const plantProps = respSchema.properties!.plant!.properties!;
            expect(plantProps.is_perennial!.type).toBe("boolean");
            expect(plantProps.caretaker!.type).toBe("object");
            expect(plantProps.caretaker!.properties!.email!.format).toBe("email");
            expect(plantProps.planted_at!.format).toBe("date-time");
        });
    });

    describe("collection-level variable resolution", () => {
        it("resolves baseUrl variable in server extraction", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "v1",
                        item: [
                            {
                                name: "Get Status",
                                request: {
                                    method: "GET",
                                    url: {
                                        raw: "{{baseUrl}}/v1/status",
                                        host: ["{{baseUrl}}"],
                                        path: ["v1", "status"]
                                    }
                                }
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);

            expect(spec.servers).toBeDefined();
            expect(spec.servers!.some((s) => s.url.includes("api.plants.example.com"))).toBe(true);

            expect(spec.paths["/v1/status"]).toBeDefined();
            expect(spec.paths["/v1/status"]!.get).toBeDefined();
        });
    });

    describe("versioned API paths (v1/v2/v3)", () => {
        it("handles multiple API versions with same resource name", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "v1",
                        item: [
                            {
                                name: "plants",
                                item: [
                                    {
                                        name: "List Plants V1",
                                        request: {
                                            method: "GET",
                                            url: {
                                                raw: "{{baseUrl}}/v1/plants",
                                                host: ["{{baseUrl}}"],
                                                path: ["v1", "plants"]
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: "v2",
                        item: [
                            {
                                name: "plants",
                                item: [
                                    {
                                        name: "List Plants V2",
                                        request: {
                                            method: "GET",
                                            url: {
                                                raw: "{{baseUrl}}/v2/plants",
                                                host: ["{{baseUrl}}"],
                                                path: ["v2", "plants"]
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);

            expect(spec.paths["/v1/plants"]).toBeDefined();
            expect(spec.paths["/v2/plants"]).toBeDefined();

            expect(spec.tags).toBeDefined();
            expect(spec.tags!.map((t) => t.name)).toContain("v1");
            expect(spec.tags!.map((t) => t.name)).toContain("v2");

            // Duplicate folder name "plants" should be deduplicated
            const plantsTags = spec.tags!.filter((t) => t.name === "plants");
            expect(plantsTags).toHaveLength(1);

            // Operations have correct hierarchical tags
            expect(spec.paths["/v1/plants"]!.get!.tags).toEqual(["v1", "plants"]);
            expect(spec.paths["/v2/plants"]!.get!.tags).toEqual(["v2", "plants"]);

            // Operation IDs should be unique
            expect(spec.paths["/v1/plants"]!.get!.operationId).not.toBe(spec.paths["/v2/plants"]!.get!.operationId);
        });
    });

    describe("response schema inference with mixed types", () => {
        it("infers schema from response containing booleans, nulls, arrays, and dates", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Get Species",
                        request: {
                            method: "GET",
                            url: {
                                raw: "{{baseUrl}}/v1/species/:id",
                                host: ["{{baseUrl}}"],
                                path: ["v1", "species", ":id"],
                                variable: [{ key: "id", value: "species-001" }]
                            }
                        },
                        response: [
                            {
                                name: "Get Species",
                                code: 200,
                                status: "OK",
                                body: JSON.stringify({
                                    species: {
                                        id: "species-001",
                                        name: "Rosa chinensis",
                                        description: "A flowering shrub",
                                        family: "Rosaceae",
                                        growth_type: "perennial",
                                        is_invasive: true,
                                        is_endangered: true,
                                        is_native: true,
                                        requires_staking: true,
                                        created_at: "2021-08-17T13:28:57.801578Z",
                                        updated_at: "2021-08-17T13:28:57.801578Z",
                                        parent_species_id: null,
                                        varieties: [
                                            {
                                                id: "var-001",
                                                species_id: "species-001",
                                                sort_key: 10,
                                                value: "Climbing"
                                            }
                                        ]
                                    }
                                })
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);
            const getOp = spec.paths["/v1/species/{id}"]!.get!;
            const respSchema = getOp.responses["200"]!.content!["application/json"]!.schema!;

            const speciesProps = respSchema.properties!.species!.properties!;

            // Boolean fields
            expect(speciesProps.is_invasive!.type).toBe("boolean");
            expect(speciesProps.is_endangered!.type).toBe("boolean");

            // String fields
            expect(speciesProps.family!.type).toBe("string");
            expect(speciesProps.growth_type!.type).toBe("string");

            // Null field produces nullable type
            expect(speciesProps.parent_species_id!.type).toEqual(["null"]);

            // Array of objects
            expect(speciesProps.varieties!.type).toBe("array");
            expect(speciesProps.varieties!.items!.type).toBe("object");
            expect(speciesProps.varieties!.items!.properties!.sort_key!.type).toBe("integer");

            // Timestamp fields
            expect(speciesProps.created_at!.format).toBe("date-time");
            expect(speciesProps.updated_at!.format).toBe("date-time");
        });
    });

    describe("request body with enum-like string fields", () => {
        it("infers mixed types correctly in request bodies", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Create Species",
                        request: {
                            method: "POST",
                            url: {
                                raw: "{{baseUrl}}/v1/species",
                                host: ["{{baseUrl}}"],
                                path: ["v1", "species"]
                            },
                            body: {
                                mode: "raw",
                                raw: JSON.stringify({
                                    description: "A flowering plant native to East Asia",
                                    growth_type: "perennial",
                                    name: "Rosa chinensis",
                                    sun_requirement: "full_sun",
                                    water_frequency: "moderate",
                                    is_invasive: true,
                                    is_endangered: true,
                                    requires_staking: true,
                                    is_native: true
                                }),
                                options: { raw: { language: "json" } }
                            }
                        }
                    }
                ]
            };

            const spec = convert(collection);
            const postOp = spec.paths["/v1/species"]!.post!;
            const bodySchema = postOp.requestBody!.content["application/json"]!.schema!;

            expect(bodySchema.properties!.growth_type!.type).toBe("string");
            expect(bodySchema.properties!.is_invasive!.type).toBe("boolean");
            expect(bodySchema.properties!.name!.type).toBe("string");
            expect(bodySchema.properties!.sun_requirement!.type).toBe("string");

            // Example is preserved
            const example = postOp.requestBody!.content["application/json"]!.example;
            expect(example).toBeDefined();
            expect((example as Record<string, unknown>).growth_type).toBe("perennial");
        });
    });

    describe("bulk operations with multiple array entries", () => {
        it("infers schema from first element of multi-entry array", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Bulk Update Plants",
                        request: {
                            method: "PUT",
                            url: {
                                raw: "{{baseUrl}}/v3/plants",
                                host: ["{{baseUrl}}"],
                                path: ["v3", "plants"]
                            },
                            body: {
                                mode: "raw",
                                raw: JSON.stringify({
                                    garden_id: "garden-001",
                                    entries: [
                                        {
                                            aliases: ["climbing-rose"],
                                            attributes: {
                                                color: {
                                                    array_value: [{ literal: "red" }],
                                                    value: { literal: "red" }
                                                }
                                            },
                                            external_id: "ext-001",
                                            name: "Climbing Rose",
                                            rank: 1
                                        },
                                        {
                                            aliases: ["tea-rose"],
                                            attributes: {
                                                color: {
                                                    array_value: [{ literal: "yellow" }],
                                                    value: { literal: "yellow" }
                                                }
                                            },
                                            external_id: "ext-002",
                                            name: "Tea Rose",
                                            rank: 2
                                        }
                                    ]
                                }),
                                options: { raw: { language: "json" } }
                            }
                        }
                    }
                ]
            };

            const spec = convert(collection);
            const putOp = spec.paths["/v3/plants"]!.put!;
            const bodySchema = putOp.requestBody!.content["application/json"]!.schema!;

            // Schema inferred from first element
            expect(bodySchema.properties!.entries!.type).toBe("array");
            expect(bodySchema.properties!.entries!.items!.type).toBe("object");

            const entryProps = bodySchema.properties!.entries!.items!.properties!;
            expect(entryProps.attributes!.type).toBe("object");
            expect(entryProps.aliases!.type).toBe("array");
            expect(entryProps.rank!.type).toBe("integer");
        });
    });

    describe("URI format detection in nested response objects", () => {
        it("infers URI format for URL strings in nested objects", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                item: [
                    {
                        name: "Get Plant Details",
                        request: {
                            method: "GET",
                            url: {
                                raw: "https://api.plants.example.com/v1/plants/1",
                                protocol: "https",
                                host: ["api", "plants", "example", "com"],
                                path: ["v1", "plants", "1"]
                            }
                        },
                        response: [
                            {
                                name: "Success",
                                code: 200,
                                status: "OK",
                                body: JSON.stringify({
                                    plant: {
                                        external_reference: {
                                            source_name: "USDA-001",
                                            source_permalink: "https://plants.usda.gov/home/plantProfile?symbol=ROSA",
                                            provider: "usda"
                                        }
                                    }
                                })
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);
            const respSchema = spec.paths["/v1/plants/1"]!.get!.responses["200"]!.content!["application/json"]!.schema!;

            const refProps = respSchema.properties!.plant!.properties!.external_reference!.properties!;
            expect(refProps.source_permalink!.format).toBe("uri");
            expect(refProps.source_name!.type).toBe("string");
            expect(refProps.provider!.type).toBe("string");
        });
    });

    describe("metadata objects with mixed types", () => {
        it("handles request body with nested object containing arrays and strings", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Create Plant Event",
                        request: {
                            method: "POST",
                            url: {
                                raw: "{{baseUrl}}/v2/plant_events/http/:sensorId",
                                host: ["{{baseUrl}}"],
                                path: ["v2", "plant_events", "http", ":sensorId"],
                                variable: [
                                    {
                                        key: "sensorId",
                                        value: "sensor-001"
                                    }
                                ]
                            },
                            body: {
                                mode: "raw",
                                raw: JSON.stringify({
                                    deduplication_key: "event-4293868629",
                                    description: "Detected low moisture on garden bed A",
                                    metadata: {
                                        garden_zone: "zone-5b",
                                        affected_beds: ["bed-1", "bed-2"]
                                    },
                                    source_url: "https://www.sensor-platform.com/alerts/alert-123",
                                    status: "active",
                                    title: "Low moisture detected"
                                }),
                                options: { raw: { language: "json" } }
                            }
                        }
                    }
                ]
            };

            const spec = convert(collection);
            const postOp = spec.paths["/v2/plant_events/http/{sensorId}"]!.post!;

            // Path param extracted
            const pathParam = postOp.parameters!.find((p) => p.name === "sensorId" && p.in === "path");
            expect(pathParam).toBeDefined();
            expect(pathParam!.required).toBe(true);

            // Nested metadata with array field
            const bodySchema = postOp.requestBody!.content["application/json"]!.schema!;
            expect(bodySchema.properties!.metadata!.type).toBe("object");
            expect(bodySchema.properties!.metadata!.properties!.affected_beds!.type).toBe("array");
            expect(bodySchema.properties!.metadata!.properties!.garden_zone!.type).toBe("string");

            // URI format inferred
            expect(bodySchema.properties!.source_url!.format).toBe("uri");
        });
    });

    describe("request body with timestamp values", () => {
        it("detects date-time format in array items and URI in nested objects", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Create Growth Record",
                        request: {
                            method: "POST",
                            url: {
                                raw: "{{baseUrl}}/v2/growth_records",
                                host: ["{{baseUrl}}"],
                                path: ["v2", "growth_records"]
                            },
                            body: {
                                mode: "raw",
                                raw: JSON.stringify({
                                    measurements: [
                                        {
                                            measurement_id: "meas-001",
                                            recorded_at: "2021-08-17T13:28:57.801578Z"
                                        }
                                    ],
                                    growing_options: {
                                        external_id: 123,
                                        reference_url: "https://docs.example.com/growing-guide",
                                        soil_type: "loam"
                                    }
                                }),
                                options: { raw: { language: "json" } }
                            }
                        }
                    }
                ]
            };

            const spec = convert(collection);
            const postOp = spec.paths["/v2/growth_records"]!.post!;
            const bodySchema = postOp.requestBody!.content["application/json"]!.schema!;

            // date-time in array items
            const measurements = bodySchema.properties!.measurements!;
            expect(measurements.type).toBe("array");
            expect(measurements.items!.properties!.recorded_at!.format).toBe("date-time");

            // Nested object with mixed types
            const growingOptions = bodySchema.properties!.growing_options!;
            expect(growingOptions.type).toBe("object");
            expect(growingOptions.properties!.external_id!.type).toBe("integer");
            expect(growingOptions.properties!.reference_url!.format).toBe("uri");
            expect(growingOptions.properties!.soil_type!.type).toBe("string");
        });
    });

    describe("empty body responses (204 No Content)", () => {
        it("omits content for responses with empty/null body", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Delete Plant",
                        request: {
                            method: "DELETE",
                            url: {
                                raw: "{{baseUrl}}/v1/plants/:plantId",
                                host: ["{{baseUrl}}"],
                                path: ["v1", "plants", ":plantId"],
                                variable: [{ key: "plantId", value: "plant-001" }]
                            }
                        },
                        response: [
                            {
                                name: "No Content",
                                code: 204,
                                status: "No Content",
                                header: [{ key: "Content-Type", value: "application/json" }],
                                body: ""
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);
            const deleteOp = spec.paths["/v1/plants/{plantId}"]!.delete!;

            // 204 with empty body should not produce content
            expect(deleteOp.responses["204"]).toBeDefined();
            expect(deleteOp.responses["204"]!.description).toBe("No Content");
            expect(deleteOp.responses["204"]!.content).toBeUndefined();
        });

        it("omits content for responses with undefined body", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "Remove Garden",
                        request: {
                            method: "DELETE",
                            url: {
                                raw: "{{baseUrl}}/v2/gardens/:gardenId",
                                host: ["{{baseUrl}}"],
                                path: ["v2", "gardens", ":gardenId"],
                                variable: [{ key: "gardenId", value: "garden-001" }]
                            }
                        },
                        response: [
                            {
                                name: "Accepted",
                                code: 202,
                                status: "Accepted",
                                header: [{ key: "Content-Type", value: "application/json" }]
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);
            const deleteOp = spec.paths["/v2/gardens/{gardenId}"]!.delete!;

            expect(deleteOp.responses["202"]).toBeDefined();
            expect(deleteOp.responses["202"]!.description).toBe("Accepted");
            expect(deleteOp.responses["202"]!.content).toBeUndefined();
        });
    });

    describe("non-JSON response body handling", () => {
        it("treats non-JSON body as text/plain instead of application/json", () => {
            const collection: PostmanCollection = {
                info: { name: "Plant API" },
                item: [
                    {
                        name: "Get OpenAPI Spec",
                        request: {
                            method: "GET",
                            url: {
                                raw: "https://api.plants.example.com/v1/openapi.json",
                                protocol: "https",
                                host: ["api", "plants", "example", "com"],
                                path: ["v1", "openapi.json"]
                            }
                        },
                        response: [
                            {
                                name: "OpenAPI Spec",
                                code: 200,
                                status: "OK",
                                header: [{ key: "Content-Type", value: "application/json" }],
                                body: "string",
                                _postman_previewlanguage: "json"
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);
            const getOp = spec.paths["/v1/openapi.json"]!.get!;

            // Non-JSON body (literal "string") should not be under application/json
            const resp = getOp.responses["200"]!;
            expect(resp.content!["application/json"]).toBeUndefined();
            expect(resp.content!["text/plain"]).toBeDefined();
            expect(resp.content!["text/plain"]!.schema!.type).toBe("string");
        });
    });

    describe("full collection conversion", () => {
        it("converts a representative multi-version collection", () => {
            const collection: PostmanCollection = {
                info: {
                    name: "Plant API",
                    description: "API reference for the Plant Management Platform.",
                    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
                },
                variable: [{ key: "baseUrl", value: "https://api.plants.example.com" }],
                item: [
                    {
                        name: "v1",
                        item: [
                            {
                                name: "plants",
                                item: [
                                    {
                                        name: "Get Plant V1",
                                        request: {
                                            method: "GET",
                                            url: {
                                                raw: "{{baseUrl}}/v1/plants/:plantId",
                                                host: ["{{baseUrl}}"],
                                                path: ["v1", "plants", ":plantId"],
                                                variable: [{ key: "plantId", value: "plant-001" }]
                                            }
                                        }
                                    },
                                    {
                                        name: "List Plants V1",
                                        request: {
                                            method: "GET",
                                            url: {
                                                raw: "{{baseUrl}}/v1/plants?garden_id=garden-001&is_perennial=true&growth_habit=vine",
                                                host: ["{{baseUrl}}"],
                                                path: ["v1", "plants"],
                                                query: [
                                                    { key: "garden_id", value: "garden-001" },
                                                    { key: "is_perennial", value: "true" },
                                                    { key: "growth_habit", value: "vine" }
                                                ]
                                            }
                                        }
                                    }
                                ]
                            },
                            {
                                name: "species",
                                item: [
                                    {
                                        name: "Create Species V1",
                                        request: {
                                            method: "POST",
                                            url: {
                                                raw: "{{baseUrl}}/v1/species",
                                                host: ["{{baseUrl}}"],
                                                path: ["v1", "species"]
                                            },
                                            body: {
                                                mode: "raw",
                                                raw: JSON.stringify({
                                                    growth_type: "perennial",
                                                    name: "Rosa chinensis",
                                                    sun_requirement: "full_sun"
                                                }),
                                                options: { raw: { language: "json" } }
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: "v2",
                        item: [
                            {
                                name: "gardens",
                                item: [
                                    {
                                        name: "Create Garden V2",
                                        request: {
                                            method: "POST",
                                            url: {
                                                raw: "{{baseUrl}}/v2/gardens",
                                                host: ["{{baseUrl}}"],
                                                path: ["v2", "gardens"]
                                            },
                                            body: {
                                                mode: "raw",
                                                raw: JSON.stringify({
                                                    layout: "raised-bed",
                                                    name: "Rose Garden",
                                                    visibility: "public"
                                                }),
                                                options: { raw: { language: "json" } }
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: "v3",
                        item: [
                            {
                                name: "plants",
                                item: [
                                    {
                                        name: "List Plants V3",
                                        request: {
                                            method: "GET",
                                            url: {
                                                raw: "{{baseUrl}}/v3/plants?page_size=25",
                                                host: ["{{baseUrl}}"],
                                                path: ["v3", "plants"],
                                                query: [{ key: "page_size", value: "25" }]
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            const spec = convert(collection);

            expect(spec.info.title).toBe("Plant API");
            expect(spec.info.description).toContain("API reference");

            expect(spec.servers).toBeDefined();
            expect(spec.servers!.some((s) => s.url.includes("api.plants.example.com"))).toBe(true);

            // Tags for all 3 API versions
            expect(spec.tags!.map((t) => t.name)).toContain("v1");
            expect(spec.tags!.map((t) => t.name)).toContain("v2");
            expect(spec.tags!.map((t) => t.name)).toContain("v3");

            // Versioned paths
            expect(spec.paths["/v1/plants/{plantId}"]).toBeDefined();
            expect(spec.paths["/v1/plants"]).toBeDefined();
            expect(spec.paths["/v1/species"]).toBeDefined();
            expect(spec.paths["/v2/gardens"]).toBeDefined();
            expect(spec.paths["/v3/plants"]).toBeDefined();

            expect(Object.keys(spec.paths).length).toBe(5);

            // Operations assigned to correct methods
            expect(spec.paths["/v1/plants/{plantId}"]!.get).toBeDefined();
            expect(spec.paths["/v1/plants"]!.get).toBeDefined();
            expect(spec.paths["/v1/species"]!.post).toBeDefined();
            expect(spec.paths["/v2/gardens"]!.post).toBeDefined();
            expect(spec.paths["/v3/plants"]!.get).toBeDefined();
        });
    });
});
