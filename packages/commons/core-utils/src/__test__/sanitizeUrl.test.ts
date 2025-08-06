import { sanitizeUrl } from "../sanitizeUrl";

describe("sanitizeUrl", () => {
  describe("undefined and empty inputs", () => {
    it("returns undefined for undefined input", () => {
      expect(sanitizeUrl(undefined)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(sanitizeUrl("")).toBeUndefined();
    });

    it("returns undefined for whitespace string", () => {
      expect(sanitizeUrl("   ")).toBeUndefined();
    });
  });

  describe("protocol-relative URLs", () => {
    it("handles protocol-relative URLs starting with //", () => {
      expect(sanitizeUrl("//example.com")).toBe("https://example.com/");
      expect(sanitizeUrl("//api.example.com/path")).toBe(
        "https://api.example.com/path"
      );
      expect(sanitizeUrl("//localhost:8080")).toBe("https://localhost:8080/");
    });

    it("returns undefined for invalid protocol-relative URLs", () => {
      expect(sanitizeUrl("//")).toBeUndefined();
    });
  });

  describe("URLs without protocol", () => {
    it("adds https:// to URLs without protocol", () => {
      expect(sanitizeUrl("example.com")).toBe("https://example.com/");
      expect(sanitizeUrl("api.example.com/path")).toBe(
        "https://api.example.com/path"
      );
      expect(sanitizeUrl("localhost:3000")).toBe("https://localhost:3000/");
    });
  });

  describe("complete URLs with protocol", () => {
    it("validates and returns complete HTTPS URLs", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com/");
      expect(sanitizeUrl("https://api.example.com/path")).toBe(
        "https://api.example.com/path"
      );
      expect(sanitizeUrl("https://localhost:8080")).toBe(
        "https://localhost:8080/"
      );
      expect(sanitizeUrl("https://example.com?param=value")).toBe(
        "https://example.com/?param=value"
      );
    });

    it("validates and returns complete HTTP URLs", () => {
      expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
      expect(sanitizeUrl("http://api.example.com/path")).toBe(
        "http://api.example.com/path"
      );
      expect(sanitizeUrl("http://localhost:8080")).toBe(
        "http://localhost:8080/"
      );
    });

    it("returns undefined for invalid complete URLs", () => {
      expect(sanitizeUrl("https://")).toBeUndefined();
      expect(sanitizeUrl("http://")).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles URLs with query parameters and fragments", () => {
      expect(sanitizeUrl("https://example.com/path?param=value#fragment")).toBe(
        "https://example.com/path?param=value#fragment"
      );
      expect(sanitizeUrl("example.com/path?param=value#fragment")).toBe(
        "https://example.com/path?param=value#fragment"
      );
    });

    it("handles URLs with special characters", () => {
      expect(sanitizeUrl("https://example.com/path with spaces")).toBe(
        "https://example.com/path%20with%20spaces"
      );
      expect(sanitizeUrl("example.com/path with spaces")).toBe(
        "https://example.com/path%20with%20spaces"
      );
    });

    it("handles URLs with authentication", () => {
      expect(sanitizeUrl("https://user:pass@example.com")).toBe(
        "https://user:pass@example.com/"
      );
      expect(sanitizeUrl("user:pass@example.com")).toBe(
        "https://user:pass@example.com/"
      );
    });

    it("handles websocket protocol", () => {
      expect(sanitizeUrl("wss://streaming.assemblyai.com")).toBe(
        "wss://streaming.assemblyai.com/"
      );
      expect(sanitizeUrl("ws://streaming.assemblyai.com")).toBe(
        "ws://streaming.assemblyai.com/"
      );
    });

    it("handles IP addresses", () => {
      expect(sanitizeUrl("https://192.168.1.1")).toBe("https://192.168.1.1/");
      expect(sanitizeUrl("192.168.1.1")).toBe("https://192.168.1.1/");
      expect(sanitizeUrl("//192.168.1.1")).toBe("https://192.168.1.1/");
    });

    it("handles localhost", () => {
      expect(sanitizeUrl("https://localhost")).toBe("https://localhost/");
      expect(sanitizeUrl("localhost")).toBe("https://localhost/");
      expect(sanitizeUrl("//localhost")).toBe("https://localhost/");
    });
  });
});
