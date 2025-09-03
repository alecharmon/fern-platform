import { createTwoslasher } from "twoslash";

const twoslasher_ = createTwoslasher({
  vfsRoot: "/mdx-bundler",
});

export function twoslasher() {
  return (
    ...parameters: Parameters<typeof twoslasher_>
  ): ReturnType<typeof twoslasher_> => {
    try {
      return twoslasher_(...parameters);
    } catch (e) {
      if (!parameters[0].includes("@allowErrors")) throw e;
      const error = e as Error;
      const lines = parameters[0].split("\n");
      const line = lines.length - 1;
      return {
        code: parameters[0],
        nodes: [
          {
            filename: "",
            level: "error",
            type: "error",
            code: 0,
            length: 100,
            start: 0,
            line,
            character: 0,
            text: error.message.replace("\n", ""),
            id: "",
          },
        ],
        // @ts-expect-error - Return type doesn't match twoslasher output but is necessary for error handling
        meta: {},
        queries: [],
        completions: [],
        errors: [],
        highlights: [],
        hovers: [],
        tags: [],
      };
    }
  };
}
