import { migrateMeta } from "@fern-docs/mdx/plugins";

describe("migrateMeta", () => {
    it("should migrate numerical ranges", () => {
        expect(migrateMeta("{1-3}")).toBe("highlight={[1,2,3]}");
        expect(migrateMeta(" {1-3}")).toBe("highlight={[1,2,3]}");
    });

    it("should migrate focus=...", () => {
        expect(migrateMeta("focus={1-2,4-5}")).toBe("focus={[1,2,4,5]}");
    });

    it("should migrate test=123 to test={123}", () => {
        expect(migrateMeta("test=123")).toBe("test={123}");
    });

    it("should migrate title=...", () => {
        expect(migrateMeta("title=abcd")).toBe('title="abcd"');
    });

    it("should migrate a full text string", () => {
        expect(migrateMeta("title=abcd test=123 focus={1-2,4-5}")).toBe('title="abcd" test={123} focus={[1,2,4,5]}');
    });

    it("should treat a plaintext string as a title", () => {
        expect(migrateMeta("this is a long string")).toBe('title="this is a long string"');
    });

    it("should migrate anything else as a title", () => {
        expect(migrateMeta('this thing has = and { and " so it should be wrapped in title')).toBe(
            'title="this thing has = and { and \\" so it should be wrapped in title"'
        );
    });

    it("should migrate meta", () => {
        expect(migrateMeta("generators.yml {7-12}")).toMatchInlineSnapshot(
            `"title="generators.yml" highlight={[7,8,9,10,11,12]}"`
        );
    });

    it("should migrate title at the end of theline", () => {
        expect(migrateMeta("{7-12} generators.yml")).toMatchInlineSnapshot(
            `"title="generators.yml" highlight={[7,8,9,10,11,12]}"`
        );
    });

    it("should strip external toolchain meta like {key=value}", () => {
        expect(migrateMeta("{metadata_that_means_nothing=true}")).toMatchInlineSnapshot(`""`);
    });

    it("should strip external toolchain meta and migrate remaining text as title", () => {
        expect(migrateMeta("python.py {metadata_that_means_nothing=true}")).toMatchInlineSnapshot(
            `"title="python.py""`
        );
    });

    it("should strip pytest_codeblocks_skip meta", () => {
        expect(migrateMeta("{pytest_codeblocks_skip=true}")).toBe("");
        expect(migrateMeta("{pytest_codeblocks_skip=false}")).toBe("");
    });

    it("should strip multiple {key=value} patterns", () => {
        expect(migrateMeta("{a=1} {b=true}")).toBe("");
    });

    it("should strip {key=value} but preserve numeric ranges in mixed meta", () => {
        expect(migrateMeta("{pytest_codeblocks_skip=true} {1-3}")).toMatchInlineSnapshot(`"highlight={[1,2,3]}"`);
        expect(migrateMeta("python.py {pytest_codeblocks_skip=true} {1-3}")).toMatchInlineSnapshot(
            `"title="python.py" highlight={[1,2,3]}"`
        );
    });

    it("should NOT strip valid Fern JSX-style attributes", () => {
        expect(migrateMeta("highlight={[1,2,3]}")).toBe("highlight={[1,2,3]}");
        expect(migrateMeta("focus={[1,2,4,5]}")).toBe("focus={[1,2,4,5]}");
        expect(migrateMeta("showLineNumbers={true}")).toMatchInlineSnapshot(`"showLineNumbers={true}"`);
        expect(migrateMeta("maxLines={100}")).toMatchInlineSnapshot(`"maxLines={100}"`);
    });

    it("should remove wordWrap if it is next to the title", () => {
        expect(migrateMeta("Python wordWrap maxLines=100")).toMatchInlineSnapshot(
            `"title="Python" wordWrap maxLines={100}"`
        );
    });

    it("should remove wordWrap if that is the only word", () => {
        expect(migrateMeta("wordWrap")).toMatchInlineSnapshot(`"wordWrap"`);
    });

    it("should remove wordWrap if it is next to just a title", () => {
        expect(migrateMeta("wordWrap myFile.txt")).toMatchInlineSnapshot(`"wordWrap title="myFile.txt""`);
    });

    it("should respect the for meta property", () => {
        expect(migrateMeta(`"a title" for="npm"`)).toMatchInlineSnapshot(`"title="a title" for="npm""`);
    });

    it("should respect the for meta property even if no title is present", () => {
        expect(migrateMeta(`for="npm"`)).toMatchInlineSnapshot(`"for="npm""`);
    });

    it("should treat URL-containing meta as a title", () => {
        expect(migrateMeta("POST https://{env}.shipbob.com/{api_version}/order lines")).toBe(
            'title="POST https://{env}.shipbob.com/{api_version}/order lines"'
        );
        expect(migrateMeta("https://example.com/api/v1")).toBe('title="https://example.com/api/v1"');
        expect(migrateMeta("GET http://localhost:3000/health")).toBe('title="GET http://localhost:3000/health"');
    });
});
