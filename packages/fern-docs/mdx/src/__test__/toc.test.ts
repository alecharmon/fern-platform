import { toTree } from "../parse";
import { makeToc } from "../toc";

describe("toc", () => {
    it("should create a toc", () => {
        const toc = makeToc(toTree(`# Hello world`).hast);
        expect(toc).toEqual([
            {
                simpleString: "Hello world",
                anchorString: "hello-world",
                children: []
            }
        ]);
    });

    it("should create a toc with a nested heading", () => {
        const toc = makeToc(toTree(`# Hello world\n\n## Nested heading`).hast);
        expect(toc).toEqual([
            {
                simpleString: "Hello world",
                anchorString: "hello-world",
                children: [
                    {
                        simpleString: "Nested heading",
                        anchorString: "nested-heading",
                        children: []
                    }
                ]
            }
        ]);
    });

    it("should respect maxDepth of 2", () => {
        const toc = makeToc(toTree(`# Hello world\n\n## Nested heading\n\n### Deep heading`).hast, 2);
        expect(toc).toEqual([
            {
                simpleString: "Hello world",
                anchorString: "hello-world",
                children: [
                    {
                        simpleString: "Nested heading",
                        anchorString: "nested-heading",
                        children: []
                    }
                ]
            }
        ]);
    });

    it("should respect complex toc with maxDepth of 2", () => {
        const toc = makeToc(
            toTree(
                `# Hello world\n\n## Nested heading\n\n### Deep heading\n\n### Another Deep heading\n\n## Nested heading 2\n\n### Deep heading 2\n\n### Another Deep heading 2`
            ).hast,
            2
        );
        expect(toc).toEqual([
            {
                simpleString: "Hello world",
                anchorString: "hello-world",
                children: [
                    {
                        simpleString: "Nested heading",
                        anchorString: "nested-heading",
                        children: []
                    },
                    {
                        simpleString: "Nested heading 2",
                        anchorString: "nested-heading-2",
                        children: []
                    }
                ]
            }
        ]);
    });

    it("should respect complex toc", () => {
        const toc = makeToc(
            toTree(
                `# Hello world\n\n## Nested heading\n\n### Deep heading\n\n### Another Deep heading\n\n## Nested heading 2\n\n### Deep heading 2\n\n### Another Deep heading 2`
            ).hast
        );
        expect(toc).toEqual([
            {
                simpleString: "Hello world",
                anchorString: "hello-world",
                children: [
                    {
                        simpleString: "Nested heading",
                        anchorString: "nested-heading",
                        children: [
                            {
                                simpleString: "Deep heading",
                                anchorString: "deep-heading",
                                children: [],
                                featureFlags: undefined
                            },
                            {
                                simpleString: "Another Deep heading",
                                anchorString: "another-deep-heading",
                                children: [],
                                featureFlags: undefined
                            }
                        ]
                    },
                    {
                        simpleString: "Nested heading 2",
                        anchorString: "nested-heading-2",
                        children: [
                            {
                                simpleString: "Deep heading 2",
                                anchorString: "deep-heading-2",
                                children: []
                            },
                            {
                                simpleString: "Another Deep heading 2",
                                anchorString: "another-deep-heading-2",
                                children: []
                            }
                        ]
                    }
                ]
            }
        ]);
    });

    it("should respect varied complex toc", () => {
        const toc = makeToc(
            toTree(
                `#### Skip Level 4\n\n## Include Level 2\n\n### Include Level 3\n\n##### Skip Nested 5\n\n#### Skip Nested 4\n\n### Regular 3\n\n## Regular 2\n\n### Last 3\n\n#### Skip Last 4`
            ).hast
        );
        expect(toc).toEqual([
            {
                simpleString: "Skip Level 4",
                anchorString: "skip-level-4",
                children: []
            },
            {
                simpleString: "Include Level 2",
                anchorString: "include-level-2",
                children: [
                    {
                        simpleString: "Include Level 3",
                        anchorString: "include-level-3",
                        children: [
                            {
                                simpleString: "Skip Nested 5",
                                anchorString: "skip-nested-5",
                                children: []
                            },
                            {
                                simpleString: "Skip Nested 4",
                                anchorString: "skip-nested-4",
                                children: []
                            }
                        ]
                    },
                    {
                        simpleString: "Regular 3",
                        anchorString: "regular-3",
                        children: []
                    }
                ]
            },
            {
                simpleString: "Regular 2",
                anchorString: "regular-2",
                children: [
                    {
                        simpleString: "Last 3",
                        anchorString: "last-3",
                        children: [
                            {
                                simpleString: "Skip Last 4",
                                anchorString: "skip-last-4",
                                children: []
                            }
                        ]
                    }
                ]
            }
        ]);
    });

    it("should respect varied complex toc with maxDepth of 3", () => {
        const toc = makeToc(
            toTree(
                `#### Skip Level 4\n\n## Include Level 2\n\n### Include Level 3\n\n##### Skip Nested 5\n\n#### Skip Nested 4\n\n### Regular 3\n\n## Regular 2\n\n### Last 3\n\n#### Skip Last 4`
            ).hast,
            3
        );
        expect(toc).toEqual([
            {
                simpleString: "Include Level 2",
                anchorString: "include-level-2",
                children: [
                    {
                        simpleString: "Include Level 3",
                        anchorString: "include-level-3",
                        children: []
                    },
                    {
                        simpleString: "Regular 3",
                        anchorString: "regular-3",
                        children: []
                    }
                ]
            },
            {
                simpleString: "Regular 2",
                anchorString: "regular-2",
                children: [
                    {
                        simpleString: "Last 3",
                        anchorString: "last-3",
                        children: []
                    }
                ]
            }
        ]);
    });

    it("should create a toc with feature flags", () => {
        const toc = makeToc(
            toTree(`<Feature flag="test" fallbackValue="false" match="true">\n# Hello world\n</Feature>`).hast
        );
        expect(toc).toEqual([
            {
                simpleString: "Hello world",
                anchorString: "hello-world",
                featureFlags: [
                    {
                        flag: "test",
                        fallbackValue: "false",
                        match: "true"
                    }
                ],
                children: []
            }
        ]);
    });

    it("should accept string literals wrapped in expressions", () => {
        const toc = makeToc(
            toTree(`<Feature flag="test" fallbackValue={"false"} match={"true"}>\n# Hello world\n</Feature>`).hast
        );
        expect(toc).toEqual([
            {
                simpleString: "Hello world",
                anchorString: "hello-world",
                children: [],
                featureFlags: [
                    {
                        flag: "test",
                        fallbackValue: "false",
                        match: "true"
                    }
                ]
            }
        ]);
    });

    it("should accept boolean literals wrapped in expressions", () => {
        const toc = makeToc(
            toTree(`<Feature flag="test" fallbackValue={true} match={false}>\n# Hello world\n</Feature>`).hast
        );
        expect(toc).toEqual([
            {
                simpleString: "Hello world",
                anchorString: "hello-world",
                children: [],
                featureFlags: [
                    {
                        flag: "test",
                        fallbackValue: true,
                        match: false
                    }
                ]
            }
        ]);
    });

    describe("steps toc depth", () => {
        it("should use tocDepth attribute from StepGroup for step depth", () => {
            const mdx = `
# Page title

<StepGroup toc={true} tocDepth="2">
  <Step id="step-1" title="First step">
    Step 1 content
  </Step>
  <Step id="step-2" title="Second step">
    Step 2 content
  </Step>
</StepGroup>
`;

            const { hast } = toTree(mdx);
            const toc = makeToc(hast);

            expect(toc).toEqual([
                {
                    simpleString: "Page title",
                    anchorString: "page-title",
                    children: [
                        {
                            simpleString: "First step",
                            anchorString: "step-1",
                            children: [],
                            featureFlags: undefined,
                            roleRequirements: undefined
                        },
                        {
                            simpleString: "Second step",
                            anchorString: "step-2",
                            children: [],
                            featureFlags: undefined,
                            roleRequirements: undefined
                        }
                    ]
                }
            ]);
        });

        it("should default to depth 3 when tocDepth is not set", () => {
            const mdx = `
## Page heading

<StepGroup toc={true}>
  <Step id="step-1" title="First step">
    Step 1 content
  </Step>
</StepGroup>
`;

            const { hast } = toTree(mdx);
            const toc = makeToc(hast);

            expect(toc).toEqual([
                {
                    simpleString: "Page heading",
                    anchorString: "page-heading",
                    children: [
                        {
                            simpleString: "First step",
                            anchorString: "step-1",
                            children: [],
                            featureFlags: undefined,
                            roleRequirements: undefined
                        }
                    ]
                }
            ]);
        });

        it("should nest steps at different depths based on tocDepth", () => {
            const mdx = `
## Section heading

<StepGroup toc={true} tocDepth="3">
  <Step id="step-a" title="Step A">
    Step A content
  </Step>
</StepGroup>
`;

            const { hast } = toTree(mdx);
            const toc = makeToc(hast);

            expect(toc).toEqual([
                {
                    simpleString: "Section heading",
                    anchorString: "section-heading",
                    children: [
                        {
                            simpleString: "Step A",
                            anchorString: "step-a",
                            children: [],
                            featureFlags: undefined,
                            roleRequirements: undefined
                        }
                    ]
                }
            ]);
        });
    });

    describe("role-based filtering", () => {
        it("should include role requirements for headings within If components", () => {
            const mdx = `
# Main Title

<If roles={["beta-users"]}>
  # Beta Feature
</If>

<If roles={["admin"]} not={true}>
  # Admin Only Feature
</If>

<If loggedIn={true}>
  # Logged In Feature
</If>
`;

            const { hast } = toTree(mdx);
            const toc = makeToc(hast);

            expect(toc).toHaveLength(4);

            expect(toc[0]?.simpleString).toBe("Main Title");
            expect(toc[0]?.roleRequirements).toBeUndefined();

            expect(toc[1]?.simpleString).toBe("Beta Feature");
            expect(toc[1]?.roleRequirements).toEqual([
                {
                    roles: ["beta-users"],
                    not: undefined,
                    loggedIn: undefined
                }
            ]);

            expect(toc[2]?.simpleString).toBe("Admin Only Feature");
            expect(toc[2]?.roleRequirements).toEqual([
                {
                    roles: ["admin"],
                    not: true,
                    loggedIn: undefined
                }
            ]);

            expect(toc[3]?.simpleString).toBe("Logged In Feature");
            expect(toc[3]?.roleRequirements).toEqual([
                {
                    roles: undefined,
                    not: undefined,
                    loggedIn: true
                }
            ]);
        });

        it("should handle nested If components", () => {
            const mdx = `
<If roles={["admin"]}>
  <If roles={["beta-users"]}>
    # Nested Feature
  </If>
</If>
`;

            const { hast } = toTree(mdx);
            const toc = makeToc(hast);

            expect(toc).toHaveLength(1);
            expect(toc[0]?.simpleString).toBe("Nested Feature");
            expect(toc[0]?.roleRequirements).toEqual([
                {
                    roles: ["admin"],
                    not: undefined,
                    loggedIn: undefined
                },
                {
                    roles: ["beta-users"],
                    not: undefined,
                    loggedIn: undefined
                }
            ]);
        });

        it("should handle If components without role attributes", () => {
            const mdx = `
<If>
  # No Role Requirements
</If>
`;

            const { hast } = toTree(mdx);
            const toc = makeToc(hast);

            expect(toc).toHaveLength(1);
            expect(toc[0]?.simpleString).toBe("No Role Requirements");
            expect(toc[0]?.roleRequirements).toBeUndefined();
        });
    });
});
