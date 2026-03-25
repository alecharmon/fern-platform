/**
 * Post-test script that syncs test results with a Google Sheet and determines
 * whether the run should be considered a failure.
 *
 * - Reads test-results.json from Playwright
 * - Fetches the allowed-failures sheet (columns: Test File | Fail Soft | Date Added | First Failure Time)
 * - Adds any new test files to the sheet (fail soft = "y" by default)
 * - Tracks first-failure-time for hard-fail tests (fail soft = "n"):
 *     - If a hard-fail test fails and has no first-failure-time, records it
 *     - If a test passes and has a first-failure-time, clears it
 * - Exits 0 if only soft-fail files failed, 1 if any hard failures remain
 * - If the Sheets API is unreachable, all failures are hard failures
 *
 * Env vars:
 *   GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY      - JSON string of the service account key
 *   GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY_PATH - or, path to the JSON key file
 *   GOOGLE_SHEETS_SPREADSHEET_ID           - spreadsheet ID (has a default)
 */

import fs from "fs";
import { google } from "googleapis";
import path from "path";

// biome-ignore lint/suspicious/noConsole: CLI script — stdout is the intended output channel
const log = console.log;
// biome-ignore lint/suspicious/noConsole: CLI script
const logError = console.error;

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "1CRERf0QHCMg8tTul5IlDEdVSfqwZbK_J-c2lXAB2FpI";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`;
const RANGE = "Sheet1";

/** Write a key=value pair to $GITHUB_OUTPUT if running in CI */
function setOutput(key: string, value: string) {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
        fs.appendFileSync(outputFile, `${key}=${value}\n`);
    }
}

interface FailedTest {
    file: string;
    name: string;
}

interface FileResult {
    file: string;
    total: number;
    failed: number;
    failedTests: FailedTest[];
}

function getServiceAccountKey(): object | null {
    if (process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY) {
        return JSON.parse(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY);
    }
    if (process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY_PATH) {
        return JSON.parse(fs.readFileSync(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY_PATH, "utf-8"));
    }
    return null;
}

function parseTestResults(resultsPath: string): FileResult[] {
    const data = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
    const byFile = new Map<string, { total: number; failed: number; failedTests: FailedTest[] }>();

    function walkSuites(suites: any[], parentTitle?: string) {
        for (const suite of suites) {
            const file = path.basename(suite.file ?? "");
            const suiteTitle = suite.title && suite.title !== file ? suite.title : parentTitle;
            for (const spec of suite.specs ?? []) {
                const entry = byFile.get(file) ?? { total: 0, failed: 0, failedTests: [] };
                entry.total++;
                if (!spec.ok) {
                    entry.failed++;
                    const name = suiteTitle ? `${suiteTitle} > ${spec.title}` : spec.title;
                    entry.failedTests.push({ file, name });
                }
                byFile.set(file, entry);
            }
            if (suite.suites) {
                walkSuites(suite.suites, suiteTitle);
            }
        }
    }

    walkSuites(data.suites ?? []);
    return [...byFile.entries()].map(([file, counts]) => ({ file, ...counts }));
}

async function main() {
    const resultsPath = path.resolve(__dirname, "..", "test-results.json");
    if (!fs.existsSync(resultsPath)) {
        log("No test-results.json found, nothing to check.");
        process.exit(0);
    }

    const fileResults = parseTestResults(resultsPath);
    const failedFiles = fileResults.filter((f) => f.failed > 0);
    const today = new Date().toISOString().split("T")[0];

    log(`Test files: ${fileResults.length}, Files with failures: ${failedFiles.length}`);

    const key = getServiceAccountKey();
    if (!key) {
        log("No Google Sheets credentials. All failures are hard failures.");
        if (failedFiles.length > 0) {
            for (const f of failedFiles) {
                log(`  • ${f.file} (${f.failed}/${f.total} failed)`);
            }
            process.exit(1);
        }
        process.exit(0);
    }

    let sheetRows: string[][];
    let sheets: ReturnType<typeof google.sheets>;

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
        });
        sheets = google.sheets({ version: "v4", auth });
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
        sheetRows = (res.data.values ?? []) as string[][];
    } catch (e: any) {
        log(`Google Sheets API error: ${e.message}`);
        log("Falling back to all-tests-must-pass mode.");
        if (failedFiles.length > 0) {
            for (const f of failedFiles) {
                log(`  • ${f.file} (${f.failed}/${f.total} failed)`);
            }
            process.exit(1);
        }
        process.exit(0);
    }

    // Parse sheet: skip header, build set of soft-fail files and first-failure-times
    const existingRows = sheetRows.slice(1);
    const softFailFiles = new Set<string>();
    const knownFiles = new Set<string>();
    const firstFailureTimes = new Map<string, string>();
    // Map file name to 1-based row index in the sheet (header is row 1)
    const fileRowIndex = new Map<string, number>();

    for (let i = 0; i < existingRows.length; i++) {
        const [file = "", failSoft = "n", , firstFailureTime = ""] = existingRows[i];
        knownFiles.add(file);
        fileRowIndex.set(file, i + 2); // +2: 1-based and skip header
        if (failSoft.toLowerCase() === "y") {
            softFailFiles.add(file);
        }
        if (firstFailureTime) {
            firstFailureTimes.set(file, firstFailureTime);
        }
    }

    // Add any new test files to the sheet
    // New test files default to fail soft = "y" so they don't break CI until explicitly hardened
    const newRows: string[][] = [];
    for (const fr of fileResults) {
        if (!knownFiles.has(fr.file)) {
            newRows.push([fr.file, "y", today, ""]);
            knownFiles.add(fr.file);
            softFailFiles.add(fr.file);
        }
    }

    if (newRows.length > 0) {
        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${RANGE}!A:D`,
                valueInputOption: "RAW",
                requestBody: { values: newRows }
            });
            log(`Added ${newRows.length} new test file(s) to the sheet.`);
        } catch (e: any) {
            log(`Warning: could not add new files to sheet: ${e.message}`);
        }
    }

    // Track first-failure-time:
    //  - Hard-fail test (fail soft = "n") that failed: record timestamp if not already set
    //  - Any test that passed: clear first-failure-time if it was previously set
    const now = new Date().toISOString();
    const failedFileNames = new Set(failedFiles.map((f) => f.file));
    const passedFileNames = new Set(fileResults.filter((f) => f.failed === 0).map((f) => f.file));
    const cellUpdates: { range: string; value: string }[] = [];

    for (const [file, rowIdx] of fileRowIndex) {
        const isHardFail = !softFailFiles.has(file);
        const didFail = failedFileNames.has(file);
        const didPass = passedFileNames.has(file);
        const hasFirstFailureTime = firstFailureTimes.has(file);

        if (isHardFail && didFail && !hasFirstFailureTime) {
            cellUpdates.push({ range: `${RANGE}!D${rowIdx}`, value: now });
            log(`Recording first failure time for ${file}`);
        } else if (didPass && hasFirstFailureTime) {
            cellUpdates.push({ range: `${RANGE}!D${rowIdx}`, value: "" });
            log(`Clearing first failure time for ${file} (now passing)`);
        }
    }

    if (cellUpdates.length > 0) {
        try {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: "RAW",
                    data: cellUpdates.map((u) => ({ range: u.range, values: [[u.value]] }))
                }
            });
            log(`Updated first-failure-time for ${cellUpdates.length} test(s).`);
        } catch (e: any) {
            log(`Warning: could not update first-failure-times: ${e.message}`);
        }
    }

    // Split failures into hard vs soft
    const hardFailures = failedFiles.filter((f) => !softFailFiles.has(f.file));
    const softFailures = failedFiles.filter((f) => softFailFiles.has(f.file));

    // Compute stats from test-results.json for the summary line
    const rawData = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
    const totalTests =
        (rawData.stats?.expected ?? 0) +
        (rawData.stats?.unexpected ?? 0) +
        (rawData.stats?.flaky ?? 0) +
        (rawData.stats?.skipped ?? 0);
    const passedTests = rawData.stats?.expected ?? 0;
    const skippedTests = rawData.stats?.skipped ?? 0;
    const failedTests = rawData.stats?.unexpected ?? 0;

    // Always output the sheet URL
    setOutput("sheet_url", SHEET_URL);

    /** Format a list of file results as "  • file: test name" lines */
    function formatFailedTests(files: FileResult[]): string {
        return files.flatMap((f) => f.failedTests.map((t) => `  • ${t.file}: ${t.name}`)).join("\\n");
    }

    if (softFailures.length > 0) {
        log(`\nSoft failures (allowed):`);
        for (const f of softFailures) {
            for (const t of f.failedTests) {
                log(`  • ${t.file}: ${t.name}`);
            }
        }
    }

    if (hardFailures.length > 0) {
        log(`\nHard failures:`);
        for (const f of hardFailures) {
            for (const t of f.failedTests) {
                log(`  • ${t.file}: ${t.name}`);
            }
        }

        let summary = `${failedTests}/${totalTests} tests failed (${passedTests} passed, ${skippedTests} skipped)`;
        summary += `\\n\\nHard failures:\\n${formatFailedTests(hardFailures)}`;
        if (softFailures.length > 0) {
            summary += `\\n\\nSoft failures (acceptable):\\n${formatFailedTests(softFailures)}`;
        }

        setOutput("outcome", "hard_failure");
        setOutput("summary", summary);
        process.exit(1);
    }

    let summary = `${passedTests}/${totalTests} tests passed (${skippedTests} skipped)`;
    if (softFailures.length > 0) {
        summary += `\\n\\nFailures marked as acceptable:\\n${formatFailedTests(softFailures)}`;
    }

    setOutput("outcome", "soft_failure");
    setOutput("summary", summary);

    log("\nAll failures are soft failures. Passing.");
    process.exit(0);
}

main().catch((e) => {
    logError(`Unexpected error: ${e.message}`);
    logError("Falling back to fail mode.");
    process.exit(1);
});
