import { AsyncApiYamlFormatter, OpenApiYamlFormatter } from "@fern-docs/search-utils";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";

const TEST_CASES_DIR = path.join(__dirname, "test_cases");

type EndpointTestCase = {
    endpoint_input: any;
    endpoint_definitions: any;
    output: any;
};

type WebhookTestCase = {
    webhook_input: any;
    type_definitions: any;
    output: any;
};

type WebSocketTestCase = {
    websocket_input: any;
    type_definitions: any;
    output: any;
};

type TestCase = EndpointTestCase | WebhookTestCase | WebSocketTestCase;

describe("OpenAPI endpoint snapshots", () => {
    // Get specific test file from environment variable or command line argument
    const testFiles = fs
        .readdirSync(TEST_CASES_DIR)
        .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
        .sort();

    for (const testFile of testFiles) {
        const testName = path.basename(testFile, path.extname(testFile));
        const testCasePath = path.join(TEST_CASES_DIR, testFile);

        it(testName, () => {
            // Load test case
            const testCaseContent = fs.readFileSync(testCasePath, "utf8");
            const testCase = yaml.load(testCaseContent) as TestCase;

            let generatedYaml: string;

            if ("webhook_input" in testCase) {
                // Webhook test case
                const formatter = new OpenApiYamlFormatter();
                generatedYaml = formatter.generateYamlFromWebhook(testCase.webhook_input, {
                    types: testCase.type_definitions || {}
                } as any);
            } else if ("websocket_input" in testCase) {
                // WebSocket test case
                const formatter = new AsyncApiYamlFormatter();
                generatedYaml = formatter.generateYamlFromWebSocket(testCase.websocket_input, {
                    types: testCase.type_definitions || {}
                } as any);
            } else {
                // Endpoint test case (default)
                const formatter = new OpenApiYamlFormatter();
                generatedYaml = formatter.generateYamlFromEndpoint(
                    testCase.endpoint_input,
                    testCase.endpoint_definitions || {}
                );
            }

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
