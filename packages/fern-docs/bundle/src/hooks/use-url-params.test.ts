// @vitest-environment jsdom
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
        Object.defineProperty(window, "location", {
            value: { pathname: "/test-path", search: "" },
            writable: true
        });
    });

    describe("addUrlParamToPathname", () => {
        it("should add a new URL parameter to the pathname", () => {
            const { addUrlParamToPathname } = useUrlParams();
            const newPath = addUrlParamToPathname("testKey", "testValue");

            expect(newPath).toBe("/test-path?testKey=testValue");
        });

        it("should update existing URL parameter", () => {
            mocks.mockSearchParams.set("existingKey", "oldValue");
            window.location = { pathname: "/test-path", search: "?existingKey=oldValue" } as Location;
            const { addUrlParamToPathname } = useUrlParams();

            const newPath = addUrlParamToPathname("existingKey", "newValue");

            expect(newPath).toBe("/test-path?existingKey=newValue");
        });
    });

    describe("removeUrlParamFromPathname", () => {
        it("should remove a URL parameter from the pathname", () => {
            mocks.mockSearchParams.set("testKey", "testValue");
            window.location = { pathname: "/test-path", search: "?testKey=testValue" } as Location;
            const { removeUrlParamFromPathname } = useUrlParams();

            const newPath = removeUrlParamFromPathname("testKey");

            expect(newPath).toBe("/test-path");
        });

        it("should return pathname without query string when no params remain", () => {
            const { removeUrlParamFromPathname } = useUrlParams();

            const newPath = removeUrlParamFromPathname("nonExistentKey");

            expect(newPath).toBe("/test-path");
        });

        it("should preserve other params when removing one", () => {
            mocks.mockSearchParams.set("keep", "yes");
            mocks.mockSearchParams.set("remove", "me");
            window.location = { pathname: "/test-path", search: "?keep=yes&remove=me" } as Location;
            const { removeUrlParamFromPathname } = useUrlParams();

            const newPath = removeUrlParamFromPathname("remove");

            expect(newPath).toBe("/test-path?keep=yes");
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
