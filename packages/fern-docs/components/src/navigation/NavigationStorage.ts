import { getBranchNameFromStorageKey } from "./localStorageUtils";
import { runMigrations } from "./migrations";
import { createEmptyNavigationSnapshot, NAVIGATION_SNAPSHOT_SCHEMA_VERSION, type NavigationSnapshot } from "./types";

export const NAVIGATION_STORAGE_KEY = "fern-navigation-storage:";

export class NavigationStorage {
    constructor(private readonly _storage: Storage) {}

    getStore(branchName: string): NavigationSnapshot | null {
        const serialized = this._storage.get(branchName);

        if (!serialized) {
            return null;
        }

        const parsed = JSON.parse(serialized) as NavigationSnapshot;
        const currentSchemaVersion = parsed.schemaVersion ?? 0;

        // Run migrations if needed
        if (currentSchemaVersion < NAVIGATION_SNAPSHOT_SCHEMA_VERSION) {
            // Create backup before migrating
            this._storage.set(`backup:v${currentSchemaVersion}:${branchName}`, serialized);
            return runMigrations(branchName, parsed, currentSchemaVersion);
        }

        return {
            ...parsed,
            metadata: {
                orgName: parsed.metadata?.orgName,
                docsUrl: parsed.metadata?.docsUrl
            },
            // Convert docsYmlChanges array back to Map after JSON parsing
            // The parsed.docsYmlChanges should be an array of [key, value] tuples
            docsYmlChanges: new Map(Array.isArray(parsed.docsYmlChanges) ? parsed.docsYmlChanges : [])
        };
    }

    setStore(branchName: string, orgName: string, docsUrl: string, data: NavigationSnapshot): void {
        const serializable = {
            ...data,
            metadata: {
                orgName,
                docsUrl
            },
            // Convert Map to Array for JSON serialization
            docsYmlChanges: Array.from(data.docsYmlChanges || new Map())
        };
        this._storage.set(branchName, JSON.stringify(serializable));
    }

    updateStore(branchName: string, orgName: string, docsUrl: string, update: Partial<NavigationSnapshot>): void {
        const prevData = this.getStore(branchName);

        if (!prevData) {
            throw new Error(`NavigationStorage could not update, branchName not found: ${branchName}`);
        }

        this.setStore(branchName, orgName, docsUrl, {
            ...prevData,
            ...update
        });
    }

    getOrSetStore(branchName: string, orgName: string, docsUrl: string): NavigationSnapshot {
        const stored = this.getStore(branchName);

        if (stored) {
            return stored;
        }

        this.setStore(branchName, orgName, docsUrl, createEmptyNavigationSnapshot(branchName, orgName, docsUrl));
        const created = this.getStore(branchName);

        if (!created) {
            throw new Error(`NavigationStorage get/set mismatch, branchName not found: ${branchName}`);
        }

        return created;
    }

    removeStore(branchName: string): void {
        this._storage.remove(branchName);
    }

    clear(): void {
        this._storage.clear();
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
            console.error("NavigationStorage operation failed:", error);
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
