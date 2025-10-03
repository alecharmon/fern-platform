import { useUrlParams } from "./use-url-params";

const mocks = vi.hoisted(() => {
    return {
        mockUsePathname: vi.fn(),
        mockUseSearchParams: vi.fn(),
        mockSearchParams: vi.mocked(new URLSearchParams())
    };
});

vi.mock("next/navigation", () => ({
    usePathname: mocks.mockUsePathname,
    useSearchParams: mocks.mockUseSearchParams
}));

vi.mock("react", () => ({
    useCallback: (callback: (...args: any[]) => any) => callback
}));

describe("useUrlParams", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        Array.from(mocks.mockSearchParams.keys()).forEach((key) => mocks.mockSearchParams.delete(key));
        mocks.mockUsePathname.mockReturnValue("/test-path");
        mocks.mockUseSearchParams.mockReturnValue(mocks.mockSearchParams);
    });

    describe("addUrlParamToPathname", () => {
        it("should add a new URL parameter to the pathname", () => {
            const { addUrlParamToPathname } = useUrlParams();
            const newPath = addUrlParamToPathname("testKey", "testValue");

            expect(newPath).toBe("/test-path?testKey=testValue");
        });

        it("should update existing URL parameter", () => {
            mocks.mockSearchParams.set("existingKey", "oldValue");
            const { addUrlParamToPathname } = useUrlParams();

            const newPath = addUrlParamToPathname("existingKey", "newValue");

            expect(newPath).toBe("/test-path?existingKey=newValue");
        });
    });

    describe("removeUrlParamFromPathname", () => {
        it("should remove a URL parameter from the pathname", () => {
            mocks.mockSearchParams.set("testKey", "testValue");
            const { removeUrlParamFromPathname } = useUrlParams();

            const newPath = removeUrlParamFromPathname("testKey");

            expect(newPath).toBe("/test-path?");
        });

        it("should return pathname with empty query string when no params remain", () => {
            const { removeUrlParamFromPathname } = useUrlParams();

            const newPath = removeUrlParamFromPathname("nonExistentKey");

            expect(newPath).toBe("/test-path?");
        });
    });

    describe("urlHasParam", () => {
        it("should return true when parameter exists", () => {
            mocks.mockSearchParams.has = vi.fn().mockReturnValue(true);
            const { urlHasParam } = useUrlParams();

            const hasParam = urlHasParam("testKey");

            expect(hasParam).toBe(true);
        });

        it("should return false when parameter does not exist", () => {
            mocks.mockSearchParams.has = vi.fn().mockReturnValue(false);
            const { urlHasParam } = useUrlParams();

            const hasParam = urlHasParam("nonExistentKey");

            expect(hasParam).toBe(false);
        });
    });
});
