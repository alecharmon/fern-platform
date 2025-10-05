import { getBranchNameFromStorageKey } from "./localStorageUtils";
import type { StoredNavigationData } from "./types";

export const NAVIGATION_STORAGE_KEY = "fern-navigation-storage:";

export class NavigationStorage {
    constructor(private readonly _storage: Storage) {}

    getStore(branchName: string): StoredNavigationData {
        const stored = this._storage.get(branchName);

        if (!stored) {
            return this._getEmptyStore();
        }

        const parsed = JSON.parse(stored) as Partial<StoredNavigationData>;

        // Convert committedFiles Array back to Set after JSON parsing
        const data: StoredNavigationData = {
            ...this._getEmptyStore(),
            ...parsed,
            metadata: {
                orgName: parsed.metadata?.orgName,
                docsUrl: parsed.metadata?.docsUrl
            },
            committedFiles: new Set(parsed.committedFiles || [])
        };

        return data;
    }

    setStore(branchName: string, orgName: string, docsUrl: string, data: StoredNavigationData): void {
        // Convert Set to Array for JSON serialization
        const serializable = {
            ...data,
            metadata: {
                orgName,
                docsUrl
            },
            committedFiles: Array.from(data.committedFiles)
        };
        this._storage.set(branchName, JSON.stringify(serializable));
    }

    updateStore(branchName: string, orgName: string, docsUrl: string, update: Partial<StoredNavigationData>): void {
        const prevData = this.getStore(branchName);
        this.setStore(branchName, orgName, docsUrl, {
            ...prevData,
            ...update,
            committedFiles: update.committedFiles ?? prevData.committedFiles
        });
    }

    removeStore(branchName: string): void {
        this._storage.remove(branchName);
    }

    clear(): void {
        this._storage.clear();
    }

    private _getEmptyStore(): StoredNavigationData {
        return {
            clientPages: {},
            docsYmlState: {
                baseContent: "",
                pendingUpdates: {},
                lastFetched: 0
            },
            committedFiles: new Set(),
            pageContents: {},
            lastCommittedHash: undefined,
            metadata: {
                docsUrl: undefined,
                orgName: undefined
            }
        };
    }

    getAllStoredBranches(): string[] {
        return this._storage
            .getAllKeys()
            .map((key) => getBranchNameFromStorageKey(key))
            .filter((key) => key !== undefined);
    }
}

export function createNavigationLocalStorage() {
    return new NavigationStorage(new LocalStorage(NAVIGATION_STORAGE_KEY));
}

export function createNavigationMemoryStorage() {
    return new NavigationStorage(new MapStorage());
}

interface Storage {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
    clear(): void;
    getAllKeys(): string[];
}

class LocalStorage implements Storage {
    constructor(private readonly _storageKey: string) {}

    private get isAvailable(): boolean {
        return typeof window !== "undefined" && typeof localStorage !== "undefined";
    }

    private safeOperation<T>(operation: () => T, fallback: T): T {
        if (!this.isAvailable) return fallback;
        try {
            return operation();
        } catch (error) {
            console.error(error);
            return fallback;
        }
    }

    get(key: string): string | null {
        return this.safeOperation(() => localStorage.getItem(this._storageKey + key), null);
    }

    set(key: string, value: string): void {
        this.safeOperation(() => {
            localStorage.setItem(this._storageKey + key, value);
        }, undefined);
    }

    getAllKeys(): string[] {
        return this.safeOperation(() => {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(this._storageKey)) {
                    keys.push(key);
                }
            }
            return keys;
        }, []);
    }

    remove(key: string): void {
        this.safeOperation(() => {
            localStorage.removeItem(this._storageKey + key);
        }, undefined);
    }

    clear(): void {
        this.safeOperation(() => {
            const keysToRemove = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(
                (key) => key?.startsWith(this._storageKey)
            );
            keysToRemove.forEach((key) => key && localStorage.removeItem(key));
        }, undefined);
    }
}

class MapStorage implements Storage {
    private _map = new Map<string, string>();

    get(key: string): string | null {
        return this._map.get(key) ?? null;
    }

    set(key: string, value: string): void {
        this._map.set(key, value);
    }

    remove(key: string): void {
        this._map.delete(key);
    }

    clear(): void {
        this._map.clear();
    }

    getAllKeys(): string[] {
        return Array.from(this._map.keys());
    }
}
