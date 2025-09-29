import fs from "fs";
import yaml from "js-yaml";
import path from "path";

import { OpenApiYamlFormatter } from "../../endpointDefinitionToOpenApi";

const TEST_CASES_DIR = path.join(__dirname, "test_cases");

type TestCase = {
  endpoint_input: any;
  endpoint_definitions: any;
  output: any;
};

describe("OpenAPI endpoint snapshots", () => {
  // Get specific test file from environment variable or command line argument
  const testFiles = fs
    .readdirSync(TEST_CASES_DIR)
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .sort();

  for (const testFile of testFiles) {
    const testName = path.basename(testFile, path.extname(testFile));
    const testCasePath = path.join(TEST_CASES_DIR, testFile);

    // eslint-disable-next-line vitest/valid-title
    it(testName, () => {
      // Load test case
      const testCaseContent = fs.readFileSync(testCasePath, "utf8");
      const testCase = yaml.load(testCaseContent) as TestCase;

      const formatter = new OpenApiYamlFormatter();
      const generatedYaml = formatter.generateYamlFromEndpoint(
        testCase.endpoint_input,
        testCase.endpoint_definitions || {}
      );

      if (process.env.UPDATE_SNAPSHOTS) {
        testCase.output = yaml.load(generatedYaml);
        const updatedTestCase = yaml.dump(testCase);
        fs.writeFileSync(testCasePath, updatedTestCase);
        console.log(`Updated expected output for test: ${testName}`);
      }

      // Get expected output from snapshot or test case
      const expectedOutput = yaml.dump(testCase.output);

      expect(generatedYaml.trim()).toEqual(expectedOutput.trim());
    });
  }
});
