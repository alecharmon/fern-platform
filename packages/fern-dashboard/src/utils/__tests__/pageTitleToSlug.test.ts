import { describe, expect, it } from "vitest";

import { pageTitleToSlug } from "../pageTitleToSlug";

describe("pageTitleToSlug", () => {
  describe("normal page titles", () => {
    it("should convert simple titles to lowercase with hyphens", () => {
      expect(pageTitleToSlug("Hello World")).toBe("hello-world");
      expect(pageTitleToSlug("My Page Title")).toBe("my-page-title");
      expect(pageTitleToSlug("API Documentation")).toBe("api-documentation");
    });

    it("should handle single words", () => {
      expect(pageTitleToSlug("Home")).toBe("home");
      expect(pageTitleToSlug("About")).toBe("about");
    });

    it("should handle numbers", () => {
      expect(pageTitleToSlug("Version 2.0")).toBe("version-20");
      expect(pageTitleToSlug("API v1")).toBe("api-v1");
    });

    it("should handle mixed case", () => {
      expect(pageTitleToSlug("JavaScript API")).toBe("javascript-api");
      expect(pageTitleToSlug("React Components")).toBe("react-components");
    });
  });

  describe("special characters and edge cases", () => {
    it("should remove special characters except hyphens", () => {
      expect(pageTitleToSlug("Hello! World?")).toBe("hello-world");
      expect(pageTitleToSlug("API & Documentation")).toBe("api-documentation");
      expect(pageTitleToSlug("User's Guide")).toBe("users-guide");
      expect(pageTitleToSlug("100% Complete")).toBe("100-complete");
    });

    it("should handle multiple spaces and hyphens", () => {
      expect(pageTitleToSlug("Hello   World")).toBe("hello-world");
      expect(pageTitleToSlug("Hello---World")).toBe("hello-world");
      expect(pageTitleToSlug("Hello - World")).toBe("hello-world");
    });

    it("should remove leading and trailing hyphens", () => {
      expect(pageTitleToSlug("-Hello World-")).toBe("hello-world");
      expect(pageTitleToSlug("---Hello World---")).toBe("hello-world");
    });

    it("should handle empty string", () => {
      expect(pageTitleToSlug("")).toBe("untitled-page");
    });

    it("should handle whitespace only", () => {
      expect(pageTitleToSlug("   ")).toBe("untitled-page");
      expect(pageTitleToSlug("\t\n")).toBe("untitled-page");
    });
  });

  describe("special characters that would produce empty slugs", () => {
    it("should handle titles with only special characters", () => {
      expect(pageTitleToSlug("✨ 🎉 ✨")).toBe("untitled-page");
      expect(pageTitleToSlug("🎊 🎈 🎊")).toBe("untitled-page");
      expect(pageTitleToSlug("🚀 🎯 🚀")).toBe("untitled-page");
    });

    it("should handle titles with only punctuation", () => {
      expect(pageTitleToSlug("!@#$%^&*()")).toBe("untitled-page");
      expect(pageTitleToSlug("???")).toBe("untitled-page");
      expect(pageTitleToSlug("...")).toBe("untitled-page");
    });

    it("should handle titles with only symbols", () => {
      expect(pageTitleToSlug("§¶†‡")).toBe("untitled-page");
      expect(pageTitleToSlug("©®™")).toBe("untitled-page");
    });

    it("should handle titles with only non-English characters", () => {
      expect(pageTitleToSlug("你好世界")).toBe("untitled-page");
      expect(pageTitleToSlug("こんにちは")).toBe("untitled-page");
      expect(pageTitleToSlug("안녕하세요")).toBe("untitled-page");
    });

    it("should handle titles with only hyphens", () => {
      expect(pageTitleToSlug("---")).toBe("untitled-page");
      expect(pageTitleToSlug("- - -")).toBe("untitled-page");
    });
  });

  describe("mixed content that produces valid slugs", () => {
    it("should handle titles with some special characters", () => {
      expect(pageTitleToSlug("Hello! World")).toBe("hello-world");
      expect(pageTitleToSlug("API & Docs")).toBe("api-docs");
      expect(pageTitleToSlug("User's Guide")).toBe("users-guide");
    });

    it("should handle titles with emojis and text", () => {
      expect(pageTitleToSlug("🚀 Getting Started")).toBe("getting-started");
      expect(pageTitleToSlug("API Documentation 📚")).toBe("api-documentation");
      expect(pageTitleToSlug("✨ Welcome ✨")).toBe("welcome");
    });

    it("should handle titles with mixed languages", () => {
      expect(pageTitleToSlug("API 文档")).toBe("api");
      expect(pageTitleToSlug("Hello 世界")).toBe("hello");
    });
  });

  describe("edge cases that could cause issues", () => {
    it("should handle very long titles", () => {
      const longTitle =
        "This is a very long page title that should be converted to a slug with many words and characters";
      expect(pageTitleToSlug(longTitle)).toBe(
        "this-is-a-very-long-page-title-that-should-be-converted-to-a-slug-with-many-words-and-characters"
      );
    });

    it("should handle titles with only numbers", () => {
      expect(pageTitleToSlug("123")).toBe("123");
      expect(pageTitleToSlug("1 2 3")).toBe("1-2-3");
    });

    it("should handle titles with only hyphens and valid characters", () => {
      expect(pageTitleToSlug("a-b-c")).toBe("a-b-c");
      expect(pageTitleToSlug("-a-b-c-")).toBe("a-b-c");
    });

    it("should handle titles that become empty after processing", () => {
      expect(pageTitleToSlug("---")).toBe("untitled-page");
      expect(pageTitleToSlug("   ---   ")).toBe("untitled-page");
      expect(pageTitleToSlug("✨🎉✨")).toBe("untitled-page");
    });
  });
});
