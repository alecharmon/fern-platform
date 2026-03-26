export interface InternalTool {
    title: string;
    description: string;
    link: string;
}

export const INTERNAL_TOOLS: InternalTool[] = [
    {
        title: "Test API",
        description: "Verify that internal API authentication is working correctly",
        link: "/test-api"
    }
];
