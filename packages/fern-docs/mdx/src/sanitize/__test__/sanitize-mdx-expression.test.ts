import { sanitizeMdxExpression } from "../sanitize-mdx-expression";

describe("sanitizeMdxExpression", () => {
    it("should escape base cases", () => {
        expect(sanitizeMdxExpression("{")).toStrictEqual(["\\{", true]);
        expect(sanitizeMdxExpression("<")).toStrictEqual(["\\<", true]);
        expect(sanitizeMdxExpression("{{")).toStrictEqual(["\\{\\{", true]);
        expect(sanitizeMdxExpression("<<")).toStrictEqual(["\\<\\<", true]);

        expect(sanitizeMdxExpression("{a}{")).toStrictEqual(["{a}\\{", true]);
        expect(sanitizeMdxExpression("<a><</a>")).toStrictEqual(["<a>\\<</a>", true]);
        expect(sanitizeMdxExpression("{{a}")).toStrictEqual(["\\{{a}", true]);
        expect(sanitizeMdxExpression("{a{}")).toStrictEqual(["\\{a{}", true]);
        expect(sanitizeMdxExpression("<a<")).toStrictEqual(["\\<a\\<", true]);

        expect(sanitizeMdxExpression("</")).toStrictEqual(["\\</", true]);
        expect(sanitizeMdxExpression("<a")).toStrictEqual(["\\<a", true]);
        expect(sanitizeMdxExpression("<a:")).toStrictEqual(["\\<a:", true]);
        expect(sanitizeMdxExpression("<a.")).toStrictEqual(["\\<a.", true]);
        expect(sanitizeMdxExpression("<a b")).toStrictEqual(["\\<a b", true]);
        expect(sanitizeMdxExpression("<a b:")).toStrictEqual(["\\<a b:", true]);
        expect(sanitizeMdxExpression("<a b=")).toStrictEqual(["\\<a b=", true]);
        expect(sanitizeMdxExpression('<a b="')).toStrictEqual(['\\<a b="', true]);
        expect(sanitizeMdxExpression("<a b='")).toStrictEqual(["\\<a b='", true]);
        expect(sanitizeMdxExpression("<a b={")).toStrictEqual(["\\<a b=\\{", true]);
        expect(sanitizeMdxExpression("<a/")).toStrictEqual(["\\<a/", true]);
        expect(sanitizeMdxExpression("<.>")).toStrictEqual(["\\<.>", true]);
        expect(sanitizeMdxExpression("</.>")).toStrictEqual(["\\</.>", true]);
        expect(sanitizeMdxExpression("<a?>")).toStrictEqual(["\\<a?>", true]);
        expect(sanitizeMdxExpression("<a:+>")).toStrictEqual(["\\<a:+>", true]);
        expect(sanitizeMdxExpression("<a./>")).toStrictEqual(["\\<a./>", true]);
        expect(sanitizeMdxExpression("<a b!>")).toStrictEqual(["\\<a b!>", true]);
        expect(sanitizeMdxExpression("<a b:1>")).toStrictEqual(["\\<a b:1>", true]);
        expect(sanitizeMdxExpression("<a b=>")).toStrictEqual(["\\<a b=>", true]);
        expect(sanitizeMdxExpression("<a/->")).toStrictEqual(["\\<a/->", true]);
        expect(sanitizeMdxExpression("> <a\nb>")).toStrictEqual(["> \\<a\nb>", true]);

        expect(sanitizeMdxExpression("a { b")).toStrictEqual(["a \\{ b", true]);
        expect(sanitizeMdxExpression("> {a\nb}")).toStrictEqual(["> \\{a\nb}", true]);
        expect(sanitizeMdxExpression("<a {b=c}={} d>")).toStrictEqual(["\\<a \\{b=c}=\\{} d>", true]);
        expect(sanitizeMdxExpression("<a {...b,c} d>")).toStrictEqual(["\\<a \\{...b,c} d>", true]);
        expect(sanitizeMdxExpression("a { b { c } d")).toStrictEqual(["a \\{ b { c } d", true]);
        expect(sanitizeMdxExpression('a {"b" "c"} d')).toStrictEqual(['a \\{"b" "c"} d', true]);
        expect(sanitizeMdxExpression('a {var b = "c"} d')).toStrictEqual(['a \\{var b = "c"} d', true]);
    });

    it("should escape only the part of the line that contains the error", () => {
        expect(sanitizeMdxExpression("a { b { c } d e")).toStrictEqual(["a \\{ b { c } d e", true]);
        expect(sanitizeMdxExpression("<Something {...props>")).toStrictEqual(["\\<Something \\{...props>", true]);
        expect(sanitizeMdxExpression("<Something {...props} d>")).toStrictEqual([
            "&lt;Something \\{...props} d&gt;",
            true
        ]);
        expect(sanitizeMdxExpression("<Something {...props} />")).toStrictEqual(["<Something {...props} />", true]);
        expect(sanitizeMdxExpression("<Something></Something>")).toStrictEqual(["<Something></Something>", true]);
        expect(sanitizeMdxExpression("<Something>{b</Something>")).toStrictEqual(["<Something>\\{b</Something>", true]);
        expect(sanitizeMdxExpression("<Something>{b}</Something>")).toStrictEqual(["<Something>{b}</Something>", true]);
        expect(sanitizeMdxExpression("<Something>{b + a}</Something>")).toStrictEqual([
            "<Something>{b + a}</Something>",
            true
        ]);

        expect(sanitizeMdxExpression("This is a test. a < b, but b > c. {c}")).toStrictEqual([
            "This is a test. a < b, but b > c. {c}",
            true
        ]);

        expect(sanitizeMdxExpression("This is a test. a <= b, but b > c. {c} d")).toStrictEqual([
            "This is a test. a \\<= b, but b > c. {c} d",
            true
        ]);
    });

    it("should handle complex cases", () => {
        expect(sanitizeMdxExpression("previous billing period) Ex. January {M1:{VM:VM0}}, February")).toStrictEqual([
            "previous billing period) Ex. January \\{M1:\\{VM:VM0}}, February",
            true
        ]);
        expect(
            sanitizeMdxExpression("from the previous month Ex. January15 {M1:{VM:VM0,on, 4}} February15")
        ).toStrictEqual(["from the previous month Ex. January15 \\{M1:\\{VM:VM0,on, 4}} February15", true]);
        expect(
            sanitizeMdxExpression("{ M1:2, M1:4 } => {M1:6} 2] Minimum - min of all the values for the")
        ).toStrictEqual(["\\{ M1:2, M1:4 } => \\{M1:6} 2] Minimum - min of all the values for the", true]);
    });

    it("should avoid escaping math expressions", () => {
        expect(sanitizeMdxExpression("$$x^2$$")).toStrictEqual(["$$x^2$$", true]);
        expect(sanitizeMdxExpression("$${x^2}$$")).toStrictEqual(["$${x^2}$$", true]);
    });

    it("should handle end-tag-mismatch", () => {
        expect(sanitizeMdxExpression("<a>")).toStrictEqual(["&lt;a&gt;", true]);

        expect(
            sanitizeMdxExpression(
                "This is the JSON that can be generated in the Google Cloud Console at https://console.cloud.google.com/iam-admin/serviceaccounts/details/<service-account-id>/keys."
            )
        ).toStrictEqual([
            "This is the JSON that can be generated in the Google Cloud Console at https://console.cloud.google.com/iam-admin/serviceaccounts/details/&lt;service-account-id&gt;/keys.",
            true
        ]);
    });

    it("should handle angle-bracket placeholders in multi-line descriptions", () => {
        const input = `URL to play.
Required if \`urls\` is not present.
Allowed URLs are:
    - http:// or https:// - audio file to GET
    - ring:[duration:]<country code> - ring tone to play`;
        const [result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
        expect(result).not.toContain("<country");
        expect(result).toContain("&lt;country");
    });

    it("should handle multiple different angle-bracket placeholders", () => {
        const input = `URL or array of URLs to play.
Allowed URLs are:
    http:// or https:// - audio file to GET
    ring:[duration:]<country code> - ring tone to play. For example: ring:us to play single ring or ring:20.`;
        const [result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
        expect(result).not.toMatch(/<country/);
    });

    it("should handle standalone angle-bracket placeholder", () => {
        const [result, handled] = sanitizeMdxExpression("Use <section_name> to define a section");
        expect(handled).toBe(true);
        expect(result).toContain("&lt;section_name&gt;");
    });

    it("should handle multiple angle-bracket placeholders in one line", () => {
        const [result, handled] = sanitizeMdxExpression("Format: <country>-<region>-<zone>");
        expect(handled).toBe(true);
        expect(result).not.toMatch(/<country|<region|<zone/);
    });

    it("should handle prose with comparison operators and quotes without infinite loop", () => {
        const input = 'If the structured output is a number, the operator must be "=", ">", "<", ">=", "<="';
        const [result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
        // Should not contain unescaped angle brackets that would be parsed as JSX
        expect(result).not.toMatch(/(?<!\\)</);
        // Should not accumulate excessive backslashes (the hallmark of the infinite loop)
        expect(result).not.toMatch(/\\{3,}/);
    });

    it("should handle multiple comparison operator descriptions", () => {
        const input = `The operator depends on the value type of the structured output.
If the structured output is a string or boolean, the operator must be "=", "!="
If the structured output is a number, the operator must be "=", ">", "<", ">=", "<="
If the structured output is an array, the operator must be "in" or "not_in"`;
        const [result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
        expect(result).not.toMatch(/\\{3,}/);
    });

    it("should handle string operator descriptions with angle brackets", () => {
        const input = 'For string type columns, the operator must be "=", "!=", "contains", "not contains"';
        const [_result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
    });

    it("should handle angle brackets mixed with quotes in inline prose", () => {
        const input = 'Use the "<" and ">" operators for numeric comparisons';
        const [result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
        expect(result).not.toMatch(/\\{3,}/);
    });

    it("should handle 2-line date type operator description", () => {
        const input = `This is the operator to use for the filter.
For date type columns, the operator must be "=", ">", "<", ">=", "<="`;
        const [result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
        expect(result).not.toMatch(/\\{3,}/);
    });

    it("should handle 2-line number type operator description", () => {
        const input = `This is the operator to use for the filter.
For number type columns, the operator must be "=", ">", "<", ">=", "<="`;
        const [result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
        expect(result).not.toMatch(/\\{3,}/);
    });

    it("should handle 5-line structured output operator description", () => {
        const input = `This is the operator to use for the filter.
The operator depends on the value type of the structured output.
If the structured output is a string or boolean, the operator must be "=", "!="
If the structured output is a number, the operator must be "=", ">", "<", ">=", "<="
If the structured output is an array, the operator must be "in" or "not_in"`;
        const [result, handled] = sanitizeMdxExpression(input);
        expect(handled).toBe(true);
        expect(result).not.toMatch(/\\{3,}/);
    });
});
