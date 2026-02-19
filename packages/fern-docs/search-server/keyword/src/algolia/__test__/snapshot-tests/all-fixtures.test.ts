import { runFixtureTest } from "./test-template";

const FIXTURES = [
    "airtop-dev",
    "assemblyai",
    "astronomer",
    "athena",
    "beehiiv",
    "boundary",
    "cohere",
    "credal",
    "ferry",
    "flatfile",
    "humanloop",
    "intrinsic",
    "keet",
    "navipartner",
    "no-version-no-tabs",
    "no-version-yes-tabs",
    "octoai",
    "polytomic",
    "propexo",
    "scoutos",
    "stack-auth",
    "thera-staging",
    "twelvelabs",
    "uploadcare",
    "vellum",
    "yes-version-no-tabs",
    "yes-version-yes-tabs"
] as const;

describe.each(FIXTURES)("%s", (fixtureName) => {
    runFixtureTest(fixtureName);
});
