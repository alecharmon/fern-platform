import { serializeMdx } from "../bundler/serialize";

vi.mock("server-only", () => ({}));

describe("remarkExtractTitle", () => {
  it("extracts title from first h1 heading and adds to frontmatter", async () => {
    const result = await serializeMdx("# My Title");
    expect(result?.frontmatter?.title).toBe("My Title");
  });

  it("preserves existing frontmatter title and does not extract from h1", async () => {
    const result = await serializeMdx(
      "---\ntitle: Existing Title\n---\n\n# My Title"
    );
    expect(result?.frontmatter?.title).toBe("Existing Title");
  });

  it("removes the extracted h1 heading from the content", async () => {
    const result = await serializeMdx("# My Title\n\nSome content");
    expect(result?.frontmatter?.title).toBe("My Title");
  });

  it("extracts title from first h1 when multiple h1s exist", async () => {
    const result = await serializeMdx("# First Title\n\n# Second Title");
    expect(result?.frontmatter?.title).toBe("First Title");
  });

  it("trims whitespace from extracted title", async () => {
    const result = await serializeMdx("#   My Title   ");
    expect(result?.frontmatter?.title).toBe("My Title");
  });

  it("updates existing frontmatter while preserving other fields", async () => {
    const result = await serializeMdx(
      "---\ndescription: Some description\n---\n\n# My Title"
    );
    expect(result?.frontmatter?.title).toBe("My Title");
    expect(result?.frontmatter?.description).toBe("Some description");
  });

  it("preserves frontmatter title when no h1 exists", async () => {
    const result = await serializeMdx(
      "---\ntitle: Frontmatter Title\n---\n\nSome content without heading"
    );
    expect(result?.frontmatter?.title).toBe("Frontmatter Title");
  });

  it("preserves frontmatter title when h1 exists but is not the first content", async () => {
    const result = await serializeMdx(
      "---\ntitle: Frontmatter Title\n---\n\nSome intro text\n\n# Page Heading\n\nMore content"
    );
    expect(result?.frontmatter?.title).toBe("Frontmatter Title");
  });

  it("preserves frontmatter title when multiple h1s exist", async () => {
    const result = await serializeMdx(
      "---\ntitle: Frontmatter Title\n---\n\n# First Heading\n\n# Second Heading"
    );
    expect(result?.frontmatter?.title).toBe("Frontmatter Title");
  });

  it("preserves frontmatter title when h1 contains markdown", async () => {
    const result = await serializeMdx(
      "---\ntitle: Frontmatter Title\n---\n\n# Page **Heading** with `code`"
    );
    expect(result?.frontmatter?.title).toBe("Frontmatter Title");
  });
});
