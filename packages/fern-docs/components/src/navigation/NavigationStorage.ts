import { getBranchNameFromStorageKey } from "./localStorageUtils";
import { runMigrations } from "./migrations";
import { createEmptyNavigationSnapshot, NAVIGATION_SNAPSHOT_SCHEMA_VERSION, type NavigationSnapshot } from "./types";

export const NAVIGATION_STORAGE_KEY = "fern-navigation-storage:";

export class NavigationStorage {
    constructor(private readonly _storage: Storage | BufferedStorage) {}

    private isBufferedStorage(storage: Storage | BufferedStorage): storage is BufferedStorage {
        return "init" in storage;
    }

    private checkBufferedStorageInitialized(): void {
        if (this.isBufferedStorage(this._storage) && !this._storage.isInitialized()) {
            throw new Error("BufferedStorage must be initialized before use. Call await storage.init() first.");
        }
    }

    async init(): Promise<void> {
        if (this.isBufferedStorage(this._storage)) {
            await this._storage.init();
        }
    }

    getStore(branchName: string): NavigationSnapshot | null {
        this.checkBufferedStorageInitialized();
        let serialized = this._storage.get(branchName);

        // If not found in current storage, check legacy LocalStorage
        if (!serialized) {
            const legacyStorage = new LocalStorage(NAVIGATION_STORAGE_KEY);
            serialized = legacyStorage.get(branchName);

            // If found in legacy storage, migrate it to current storage
            if (serialized) {
                this._storage.set(branchName, serialized);
            }
        }

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
            // Convert docsYmlChanges array back to Map after JSON parsing
            // The parsed.docsYmlChanges should be an array of [key, value] tuples
            docsYmlChanges: new Map(Array.isArray(parsed.docsYmlChanges) ? parsed.docsYmlChanges : [])
        };
    }

    setStore(branchName: string, orgName: string, docsUrl: string, data: NavigationSnapshot): void {
        this.checkBufferedStorageInitialized();
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
        this.checkBufferedStorageInitialized();
        this._storage.remove(branchName);

        // Also remove from legacy LocalStorage if it exists
        const legacyStorage = new LocalStorage(NAVIGATION_STORAGE_KEY);
        legacyStorage.remove(branchName);
    }

    clear(): void {
        this.checkBufferedStorageInitialized();
        this._storage.clear();

        // Also clear legacy LocalStorage
        const legacyStorage = new LocalStorage(NAVIGATION_STORAGE_KEY);
        legacyStorage.clear();
    }

    getAllStoredBranches(): string[] {
        this.checkBufferedStorageInitialized();
        const currentBranches = this._storage
            .getAllKeys()
            .map((key) => getBranchNameFromStorageKey(key))
            .filter((key) => key !== undefined);

        // Also check legacy LocalStorage for branches not in current storage
        const legacyStorage = new LocalStorage(NAVIGATION_STORAGE_KEY);
        const legacyBranches = legacyStorage
            .getAllKeys()
            .map((key) => getBranchNameFromStorageKey(key))
            .filter((key) => key !== undefined);

        // Combine and deduplicate
        return Array.from(new Set([...currentBranches, ...legacyBranches]));
    }
}

export function createNavigationBufferedIndexedDBStorage() {
    return new NavigationStorage(new BufferedIndexedDBStorage(NAVIGATION_STORAGE_KEY));
}

/** @deprecated Use createNavigationBufferedIndexedDBStorage instead */
export function _legacyCreateNavigationLocalStorage() {
    return new NavigationStorage(new LocalStorage(NAVIGATION_STORAGE_KEY));
}

export function _createNavigationMemoryStorage() {
    return new NavigationStorage(new MapStorage());
}

interface Storage {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
    clear(): void;
    getAllKeys(): string[];
}

interface BufferedStorage extends Storage {
    init(): Promise<void>;
    isInitialized(): boolean;
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

/**
 * BufferedIndexedDBStorage provides a synchronous storage interface backed by IndexedDB.
 *
 * This implementation maintains a in-memory cache of all data to enable synchronous get/set operations while persisting data to IndexedDB in the background for durability.
 *
 * Key features:
 * - Caching: preloads from IndexedDB to memory during initialization
 * - Synchronous API: all read operations return immediately from the in-memory cache
 * - Background persistence: writes are debounced and batched to IndexedDB
 * - Graceful fallback: falls back to memory-only operation if IndexedDB is unavailable
 */
class BufferedIndexedDBStorage implements BufferedStorage {
    private readonly dbName = "fern-navigation-storage";
    private readonly storeName = "navigation";
    private readonly version = 1;
    private cache = new Map<string, string>();
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;
    private pendingWrites = new Map<string, string>();
    private writeTimer: ReturnType<typeof setTimeout> | null = null;
    private _initialized = false;

    constructor(private readonly _storageKey: string) {}

    private get isAvailable(): boolean {
        return typeof window !== "undefined" && typeof indexedDB !== "undefined";
    }

    private getFullKey(key: string): string {
        return this._storageKey + key;
    }

    /** Initializes the storage by opening IndexedDB and preloading all data into the in-memory cache */
    async init(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }

        if (!this.isAvailable) {
            console.warn("IndexedDB not available, using in-memory cache only");
            this._initialized = true;
            return Promise.resolve();
        }

        this.initPromise = this._initDB();
        return this.initPromise;
    }

    /** Returns whether the storage has been initialized */
    isInitialized(): boolean {
        return this._initialized;
    }

    private async _initDB(): Promise<void> {
        try {
            this.db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.version);

                request.onerror = () => {
                    console.error("IndexedDB failed to open:", request.error);
                    reject(new Error(request.error?.toString() ?? "IndexedDB failed to open"));
                };

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName);
                    }
                };
            });

            // Preload all data into cache for synchronous access
            await this._preloadCache();
        } catch (error) {
            console.error("Failed to initialize IndexedDB:", error);
            // Continue with in-memory cache only
        } finally {
            this._initialized = true;
        }
    }

    /** Preloads all existing data from IndexedDB into the in-memory cache. */
    private async _preloadCache(): Promise<void> {
        if (!this.db) {
            return;
        }

        try {
            const transaction = this.db.transaction([this.storeName], "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.getAllKeys();

            const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error(request.error?.toString() ?? "IndexedDB operation failed"));
            });

            // Load each key's value into cache
            await Promise.all(
                keys.map(async (key) => {
                    if (typeof key === "string" && key.startsWith(this._storageKey)) {
                        const value = await this._getFromDB(key);
                        if (value != null) {
                            this.cache.set(key, value);
                        }
                    }
                })
            );
        } catch (error) {
            console.error("Failed to preload cache from IndexedDB:", error);
        }
    }

    /** Retrieves a value directly from IndexedDB (bypassing cache). Used during cache preloading. */
    private async _getFromDB(fullKey: string): Promise<string | null> {
        if (!this.db) {
            return null;
        }

        try {
            const transaction = this.db.transaction([this.storeName], "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.get(fullKey);

            return await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result ?? null);
                };
                request.onerror = () => {
                    console.error("IndexedDB get failed:", request.error);
                    reject(new Error(request.error?.toString() ?? "IndexedDB get failed"));
                };
            });
        } catch (error) {
            console.error("IndexedDB get operation failed:", error);
            return null;
        }
    }

    /** Schedules a debounced write to IndexedDB to batch multiple updates together. */
    private _scheduleWrite(): void {
        if (this.writeTimer != null) {
            clearTimeout(this.writeTimer);
        }

        this.writeTimer = setTimeout(() => {
            void this._flushWrites();
        }, 100); // Debounce writes by 100ms
    }

    /** Flushes all pending writes to IndexedDB in a single transaction. */
    private async _flushWrites(): Promise<void> {
        if (!this.db || this.pendingWrites.size === 0) {
            return;
        }

        const writes = Array.from(this.pendingWrites.entries());
        this.pendingWrites.clear();

        try {
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);

            writes.forEach(([key, value]) => {
                store.put(value, key);
            });

            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => {
                    resolve();
                };
                transaction.onerror = () => {
                    console.error("IndexedDB write transaction failed:", transaction.error);
                    reject(new Error(transaction.error?.toString() ?? "IndexedDB write transaction failed"));
                };
            });
        } catch (error) {
            console.error("Failed to flush writes to IndexedDB:", error);
            throw error;
        }
    }

    /** Retrieves a value synchronously from the in-memory cache. */
    get(key: string): string | null {
        const fullKey = this.getFullKey(key);
        return this.cache.get(fullKey) ?? null;
    }

    /** Sets a value synchronously in the in-memory cache and schedules a background write to IndexedDB. */
    set(key: string, value: string): void {
        const fullKey = this.getFullKey(key);
        // Update cache immediately for synchronous access
        this.cache.set(fullKey, value);

        // Queue write to IndexedDB for persistence
        if (this.db) {
            this.pendingWrites.set(fullKey, value);
            this._scheduleWrite();
        }
    }

    /** Removes a value synchronously from the in-memory cache and from IndexedDB. */
    remove(key: string): void {
        const fullKey = this.getFullKey(key);
        // Remove from cache immediately
        this.cache.delete(fullKey);

        // Remove from IndexedDB immediately (not debounced)
        if (this.db) {
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);
            store.delete(fullKey);

            transaction.onerror = () => {
                console.error("IndexedDB remove failed:", transaction.error);
            };
        }
    }

    /** Clears all values with the current storage prefix from both cache and IndexedDB. */
    clear(): void {
        // Clear only keys with our prefix to avoid affecting other data
        const keysToDelete = Array.from(this.cache.keys()).filter((k) => k.startsWith(this._storageKey));
        keysToDelete.forEach((key) => this.cache.delete(key));

        if (this.db) {
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);

            keysToDelete.forEach((key) => {
                store.delete(key);
            });

            transaction.onerror = () => {
                console.error("IndexedDB clear failed:", transaction.error);
            };
        }
    }

    /** Returns all keys with the current storage prefix from the in-memory cache. */
    getAllKeys(): string[] {
        return Array.from(this.cache.keys()).filter((k) => k.startsWith(this._storageKey));
    }
}
