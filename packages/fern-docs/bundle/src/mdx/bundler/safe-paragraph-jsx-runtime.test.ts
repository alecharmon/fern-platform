import React from "react";
import _jsx_runtime from "react/jsx-runtime";

import { safeParagraphJsxRuntime } from "./safe-paragraph-jsx-runtime";

type AnyRuntime = Record<string, any>;

function createMockRuntime() {
    const calls: { fn: string; type: unknown; props: unknown; key: unknown }[] = [];
    return {
        calls,
        runtime: {
            jsx: (type: unknown, props: unknown, key?: unknown) => {
                calls.push({ fn: "jsx", type, props, key });
                return { type, props, key };
            },
            jsxs: (type: unknown, props: unknown, key?: unknown) => {
                calls.push({ fn: "jsxs", type, props, key });
                return { type, props, key };
            },
            Fragment: React.Fragment
        } as AnyRuntime
    };
}

function reactElement(type: string, props?: Record<string, unknown>): React.ReactElement {
    return { type, props: props ?? {}, key: null } as unknown as React.ReactElement;
}

function lastCall(calls: { fn: string; type: unknown; props: unknown; key: unknown }[]) {
    const call = calls[calls.length - 1];
    if (call == null) {
        throw new Error("Expected at least one call");
    }
    return call;
}

describe("safeParagraphJsxRuntime", () => {
    describe("wrapping behavior", () => {
        it("should return an object with jsx, jsxs, and Fragment", () => {
            const { runtime } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            expect(wrapped.jsx).toBeTypeOf("function");
            expect(wrapped.jsxs).toBeTypeOf("function");
            expect(wrapped.Fragment).toBe(React.Fragment);
        });

        it("should preserve additional properties from the original runtime", () => {
            const { runtime } = createMockRuntime();
            (runtime as AnyRuntime).customProp = "test-value";
            const wrapped = safeParagraphJsxRuntime(runtime);

            expect(wrapped.customProp).toBe("test-value");
        });
    });

    describe("jsx (single child)", () => {
        it("should pass through <p> with text children unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: "Hello world" });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).fn).toBe("jsx");
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with no children unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", {});

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with null children unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: null });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with undefined children unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: undefined });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with numeric children unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: 42 });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with boolean children unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: true });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should convert <p> to <div> when child is a <div> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("div") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).fn).toBe("jsx");
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is a <table> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("table") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is a <ul> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("ul") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is an <ol> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("ol") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is a <section> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("section") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is a <blockquote> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("blockquote") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is a <pre> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("pre") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is a <form> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("form") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is an <article> element", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("article") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when child is a heading (h1-h6)", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            for (const heading of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
                calls.length = 0;
                wrapped.jsx("p", { children: reactElement(heading) });
                expect(lastCall(calls).type).toBe("div");
            }
        });

        it("should pass through <p> with inline-level children (e.g. <span>) unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("span") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with <strong> child unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("strong") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with <em> child unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("em") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with <a> child unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("a") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with <code> child unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("code") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with <img> child unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("img") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with a React component child unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            const MyComponent = () => null;
            wrapped.jsx("p", { children: { type: MyComponent, props: {}, key: null } });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });
    });

    describe("jsxs (multiple children)", () => {
        it("should pass through <p> with only text children unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", { children: ["Hello", " ", "world"] });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).fn).toBe("jsxs");
            expect(lastCall(calls).type).toBe("p");
        });

        it("should pass through <p> with only inline elements unchanged", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", {
                children: [reactElement("strong", { children: "bold" }), " text ", reactElement("em")]
            });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should convert <p> to <div> when children array contains a <div>", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", {
                children: [reactElement("strong", { children: "Model ID" }), reactElement("div", { children: "value" })]
            });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).fn).toBe("jsxs");
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when any child in array is block-level", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", {
                children: ["text before", reactElement("ul"), "text after"]
            });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when last child is block-level", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", {
                children: ["some text", reactElement("span"), reactElement("table")]
            });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should convert <p> to <div> when first child is block-level", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", {
                children: [reactElement("div"), "some text"]
            });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should handle mixed inline and block children - converts to <div>", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", {
                children: [
                    reactElement("strong"),
                    reactElement("em"),
                    reactElement("div"),
                    reactElement("span"),
                    "text"
                ]
            });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });
    });

    describe("non-<p> elements", () => {
        it("should not modify <div> elements", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("div", { children: reactElement("div") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should not modify <span> elements even with block children", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("span", { children: reactElement("div") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("span");
        });

        it("should not modify <section> elements", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("section", { children: reactElement("div") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("section");
        });

        it("should not modify component type elements", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            const MyComponent = () => null;
            wrapped.jsx(MyComponent, { children: reactElement("div") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe(MyComponent);
        });

        it("should not modify heading elements even with block children", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("h1", { children: reactElement("div") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("h1");
        });
    });

    describe("props and key forwarding", () => {
        it("should forward all props when converting <p> to <div>", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            const props = {
                style: { color: "red", fontSize: "14px" },
                className: "my-class",
                id: "my-id",
                children: reactElement("div")
            };
            wrapped.jsx("p", props);

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
            expect(lastCall(calls).props).toBe(props);
        });

        it("should forward key when converting <p> to <div>", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("div") }, "my-key");

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
            expect(lastCall(calls).key).toBe("my-key");
        });

        it("should forward props unchanged when <p> is not converted", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            const props = { style: { color: "blue" }, className: "safe", children: "text" };
            wrapped.jsx("p", props);

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
            expect(lastCall(calls).props).toBe(props);
        });

        it("should forward key unchanged when <p> is not converted", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: "text" }, "my-key");

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
            expect(lastCall(calls).key).toBe("my-key");
        });
    });

    describe("real-world patterns (Cohere Command A page)", () => {
        it("should convert the exact pattern from the Cohere MDX: <p> with <strong> + <div>", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", {
                style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    margin: 0
                },
                children: [
                    reactElement("strong", { children: "Model ID" }),
                    reactElement("div", {
                        style: { fontSize: "0.875rem", color: "#666" },
                        children: "command-a-03-2025"
                    })
                ]
            });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).fn).toBe("jsxs");
            expect(lastCall(calls).type).toBe("div");
            // Verify props are passed through so styles are preserved
            expect((lastCall(calls).props as { style: { display: string } }).style.display).toBe("flex");
        });

        it("should handle nested <p> inside <p> (converts outer to <div>)", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: reactElement("p") });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });
    });

    describe("edge cases", () => {
        it("should handle empty children array", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", { children: [] });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should handle children array with only null/undefined", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", { children: [null, undefined] });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should handle children array with mixed nulls and block elements", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsxs("p", { children: [null, reactElement("div"), undefined] });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("div");
        });

        it("should not deeply inspect children of children (shallow check only)", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            // <p><span><div/></span></p> - the div is nested inside span, not a direct child
            wrapped.jsx("p", {
                children: reactElement("span", { children: reactElement("div") })
            });

            // Should NOT convert because the div is nested inside span
            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should handle children that are plain objects without type property", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: { someKey: "someValue" } });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should handle children that are objects with non-string type", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            wrapped.jsx("p", { children: { type: 123, props: {} } });

            expect(calls).toHaveLength(1);
            expect(lastCall(calls).type).toBe("p");
        });

        it("should handle deeply nested arrays in children", () => {
            const { runtime, calls } = createMockRuntime();
            const wrapped = safeParagraphJsxRuntime(runtime);

            // React can sometimes pass nested arrays as children
            wrapped.jsxs("p", {
                children: ["text", [reactElement("div")]]
            });

            expect(calls).toHaveLength(1);
            // Nested arrays should be scanned
            expect(lastCall(calls).type).toBe("div");
        });
    });

    describe("integration with real react/jsx-runtime", () => {
        it("should accept the real react/jsx-runtime module", () => {
            const wrapped = safeParagraphJsxRuntime(_jsx_runtime);

            expect(wrapped.jsx).toBeTypeOf("function");
            expect(wrapped.jsxs).toBeTypeOf("function");
            expect(wrapped.Fragment).toBeDefined();
        });

        it("should produce a valid React element for <p> with text", () => {
            const wrapped = safeParagraphJsxRuntime(_jsx_runtime);
            const element = wrapped.jsx("p", { children: "hello" });

            expect(element).toBeDefined();
            expect(element.type).toBe("p");
            expect((element as React.ReactElement<{ children: string }>).props.children).toBe("hello");
        });

        it("should produce a <div> element when <p> contains a block-level child", () => {
            const wrapped = safeParagraphJsxRuntime(_jsx_runtime);
            const divChild = _jsx_runtime.jsx("div", { children: "block content" });
            const element = wrapped.jsx("p", { children: divChild });

            expect(element).toBeDefined();
            expect(element.type).toBe("div");
            expect((element as React.ReactElement<{ children: typeof divChild }>).props.children).toBe(divChild);
        });

        it("should produce a <p> element when children are inline only", () => {
            const wrapped = safeParagraphJsxRuntime(_jsx_runtime);
            const spanChild = _jsx_runtime.jsx("span", { children: "inline content" });
            const element = wrapped.jsx("p", { children: spanChild });

            expect(element).toBeDefined();
            expect(element.type).toBe("p");
        });

        it("should handle jsxs with multiple children including block element", () => {
            const wrapped = safeParagraphJsxRuntime(_jsx_runtime);
            const strongChild = _jsx_runtime.jsx("strong", { children: "Label" });
            const divChild = _jsx_runtime.jsx("div", { children: "value" });
            const element = wrapped.jsxs("p", { children: [strongChild, divChild] });

            expect(element).toBeDefined();
            expect(element.type).toBe("div");
        });

        it("should handle jsxs with multiple inline-only children", () => {
            const wrapped = safeParagraphJsxRuntime(_jsx_runtime);
            const strongChild = _jsx_runtime.jsx("strong", { children: "Label" });
            const spanChild = _jsx_runtime.jsx("span", { children: "value" });
            const element = wrapped.jsxs("p", { children: [strongChild, spanChild] });

            expect(element).toBeDefined();
            expect(element.type).toBe("p");
        });
    });

    describe("all block-level tags are detected", () => {
        const blockTags = [
            "address",
            "article",
            "aside",
            "blockquote",
            "details",
            "dialog",
            "dd",
            "div",
            "dl",
            "dt",
            "fieldset",
            "figcaption",
            "figure",
            "footer",
            "form",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "header",
            "hgroup",
            "hr",
            "li",
            "main",
            "nav",
            "ol",
            "p",
            "pre",
            "section",
            "table",
            "ul"
        ];

        for (const tag of blockTags) {
            it(`should convert <p> to <div> when child is <${tag}>`, () => {
                const { runtime, calls } = createMockRuntime();
                const wrapped = safeParagraphJsxRuntime(runtime);

                wrapped.jsx("p", { children: reactElement(tag) });

                expect(calls).toHaveLength(1);
                expect(lastCall(calls).type).toBe("div");
            });
        }
    });
});
