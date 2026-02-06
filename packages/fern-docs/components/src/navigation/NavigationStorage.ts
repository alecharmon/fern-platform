import { getBranchNameFromStorageKey } from "./localStorageUtils";
import { runMigrations } from "./migrations";
import { createEmptyNavigationSnapshot, NAVIGATION_SNAPSHOT_SCHEMA_VERSION, type NavigationSnapshot } from "./types";

export const NAVIGATION_STORAGE_KEY = "fern-navigation-storage:";

export interface BranchMetadata {
    branchName: string;
    metadata: {
        orgName: string;
        docsUrl: string;
        prTitle?: string;
        prUrl?: string;
    };
}

/**
 * NavigationStorage provides persistence for navigation state across page reloads.
 *
 * IMPORTANT: Potential race condition issue with async storage writes
 * ---------------------------------------------------------------
 * The `setStore` method is called frequently during editing operations (page creation,
 * section renames, deletions, etc.). Since storage operations can be async (especially
 * with BufferedStorage backed by IndexedDB), rapid consecutive updates may result in
 * writes completing out of order.
 *
 * Example scenario:
 * 1. User renames section "A" -> "B" (triggers write #1)
 * 2. User immediately renames "B" -> "C" (triggers write #2)
 * 3. If write #2 completes before write #1, final state could be "B" instead of "C"
 *
 * Potential solutions to investigate:
 * - Implement a write queue to ensure sequential completion
 * - Debounce storage writes (but maintain responsiveness)
 * - Use version/timestamp to detect and discard stale writes
 * - Switch to synchronous storage with async background persistence
 *
 * Currently this is a known limitation but has not caused reported issues in practice.
 */
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

    /**
     * Initializes storage. Optionally preloads a specific branch.
     * @param branchToPreload - Optional branch name to eagerly load into cache
     */
    async init(branchToPreload?: string): Promise<void> {
        if (this.isBufferedStorage(this._storage)) {
            await this._storage.init(branchToPreload);
            this.cleanupNestedBackups();
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

        const parsed = JSON.parse(serialized);
        const currentSchemaVersion: number = parsed.schemaVersion ?? 0;

        // Run migrations if needed
        if (currentSchemaVersion < NAVIGATION_SNAPSHOT_SCHEMA_VERSION) {
            console.debug(
                `[NavigationStorage] Migrating branch "${branchName}" from schema v${currentSchemaVersion} to v${NAVIGATION_SNAPSHOT_SCHEMA_VERSION}`
            );
            // Create backup before migrating (only if one doesn't exist for this version)
            const backupKey = `backup:v${currentSchemaVersion}:${branchName}`;
            if (!this._storage.get(backupKey)) {
                this._storage.set(backupKey, serialized);
            }

            // Deserialize schema-specific fields before migration
            const dataToMigrate: any = { ...parsed };

            // V0 → V1: committedFiles is a Set (serialized as array)
            if (currentSchemaVersion === 0 && Array.isArray(parsed.committedFiles)) {
                dataToMigrate.committedFiles = new Set(parsed.committedFiles);
            }

            // V1 → V2: docsYmlChanges is a Map (serialized as array)
            if (currentSchemaVersion === 1 && Array.isArray(parsed.docsYmlChanges)) {
                dataToMigrate.docsYmlChanges = new Map(parsed.docsYmlChanges);
            }

            // V1 → V2: docsYmlBaseContent might already be a serialized Map (array of tuples)
            // Deserialize it before passing to migration to ensure idempotency
            if (
                currentSchemaVersion === 1 &&
                Array.isArray(parsed.docsYmlBaseContent) &&
                parsed.docsYmlBaseContent.length > 0 &&
                Array.isArray(parsed.docsYmlBaseContent[0])
            ) {
                dataToMigrate.docsYmlBaseContent = new Map(parsed.docsYmlBaseContent as [string, string][]);
            }

            const migrated = runMigrations(branchName, dataToMigrate, currentSchemaVersion);

            // Persist migrated data back to storage
            this.setStore(branchName, migrated.metadata.orgName, migrated.metadata.docsUrl, migrated);

            // Clean up old backups after successful migration to prevent storage bloat
            // Keep only the most recent backup (the one we just created)
            this.cleanupOldBackups(branchName, currentSchemaVersion);

            return migrated;
        }

        // Current version - deserialize Maps and Sets
        const deserialized: NavigationSnapshot = {
            ...(parsed as NavigationSnapshot),
            // Deserialize: Array of [key, value] tuples → Map
            navigationChanges: new Map(
                Array.isArray(parsed.navigationChanges) ? parsed.navigationChanges : []
            ) as NavigationSnapshot["navigationChanges"],
            // Deserialize: Array of entries → Map for multi-file, or keep as string | null for single-file
            docsYmlBaseContent:
                Array.isArray(parsed.docsYmlBaseContent) &&
                (parsed.docsYmlBaseContent.length === 0 || Array.isArray(parsed.docsYmlBaseContent[0]))
                    ? new Map(parsed.docsYmlBaseContent as [string, string][])
                    : parsed.docsYmlBaseContent,
            // Deserialize: Array of entries → Map
            slugToDocsYmlFilePath:
                parsed.slugToDocsYmlFilePath != null && Array.isArray(parsed.slugToDocsYmlFilePath)
                    ? new Map(parsed.slugToDocsYmlFilePath as [string, string][])
                    : parsed.slugToDocsYmlFilePath,
            // Deserialize: Array of entries → Map (OpenAPI pending changes)
            openApiPendingChanges:
                parsed.openApiPendingChanges != null && Array.isArray(parsed.openApiPendingChanges)
                    ? new Map(parsed.openApiPendingChanges)
                    : new Map()
        };

        return deserialized;
    }

    setStore(branchName: string, orgName: string, docsUrl: string, data: NavigationSnapshot): void {
        this.checkBufferedStorageInitialized();

        const serializable = {
            ...data,
            metadata: {
                ...data.metadata,
                orgName,
                docsUrl
            },
            // Serialize: Map → Array of [key, value] tuples for JSON
            navigationChanges: Array.from(data.navigationChanges || new Map()),
            // Serialize: Map → Array for multi-file, or keep as string | null for single-file
            docsYmlBaseContent:
                data.docsYmlBaseContent instanceof Map
                    ? Array.from(data.docsYmlBaseContent.entries())
                    : data.docsYmlBaseContent,
            // Serialize: Map → Array of entries for JSON
            slugToDocsYmlFilePath:
                data.slugToDocsYmlFilePath instanceof Map
                    ? Array.from(data.slugToDocsYmlFilePath.entries())
                    : data.slugToDocsYmlFilePath,
            // Serialize: Map → Array of entries for JSON (OpenAPI pending changes)
            openApiPendingChanges:
                data.openApiPendingChanges instanceof Map ? Array.from(data.openApiPendingChanges.entries()) : []
        };

        const serialized = JSON.stringify(serializable);
        this._storage.set(branchName, serialized);
    }

    updateBranchMetadata(branchName: string, updates: { prTitle?: string; prUrl?: string }): void {
        this.checkBufferedStorageInitialized();
        const serialized = this._storage.get(branchName);
        if (!serialized) {
            return;
        }
        const parsed = JSON.parse(serialized);
        if (!parsed.metadata || typeof parsed.metadata !== "object") {
            return;
        }
        if ("prTitle" in updates) {
            if (updates.prTitle) {
                parsed.metadata.prTitle = updates.prTitle;
            } else {
                delete parsed.metadata.prTitle;
            }
        }
        if ("prUrl" in updates) {
            if (updates.prUrl) {
                parsed.metadata.prUrl = updates.prUrl;
            } else {
                delete parsed.metadata.prUrl;
            }
        }
        this._storage.set(branchName, JSON.stringify(parsed));
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

        // Also remove backups for this branch
        this.removeBackupsForBranch(branchName);

        // Also remove from legacy LocalStorage if it exists
        const legacyStorage = new LocalStorage(NAVIGATION_STORAGE_KEY);
        legacyStorage.remove(branchName);
    }

    /** Removes all backup entries for a given branch */
    private removeBackupsForBranch(branchName: string): void {
        const allKeys = this._storage.getAllKeys();
        const backupKeys = allKeys.filter((key) => key.includes(`backup:`) && key.endsWith(`:${branchName}`));
        backupKeys.forEach((key) => {
            const cleanKey = getBranchNameFromStorageKey(key);
            if (cleanKey) {
                this._storage.remove(cleanKey);
            }
        });
    }

    /** Cleans up old backup entries, keeping only the most recent one */
    private cleanupOldBackups(branchName: string, currentVersion: number): void {
        const allKeys = this._storage.getAllKeys();
        const backupKeys = allKeys.filter((key) => key.includes(`backup:`) && key.endsWith(`:${branchName}`));

        let removedCount = 0;
        // Remove backups for versions older than the current one
        backupKeys.forEach((key) => {
            // Extract version from key format: "backup:vN:branchName"
            const versionMatch = key.match(/backup:v(\d+):/);
            if (versionMatch?.[1]) {
                const backupVersion = parseInt(versionMatch[1], 10);
                if (backupVersion < currentVersion) {
                    const cleanKey = getBranchNameFromStorageKey(key);
                    if (cleanKey) {
                        this._storage.remove(cleanKey);
                        removedCount++;
                    }
                }
            }
        });

        if (removedCount > 0) {
            console.debug(`[NavigationStorage] Cleaned up ${removedCount} backup(s) for branch ${branchName}`);
        }
    }

    clear(): void {
        this.checkBufferedStorageInitialized();
        this._storage.clear();

        // Also clear legacy LocalStorage
        const legacyStorage = new LocalStorage(NAVIGATION_STORAGE_KEY);
        legacyStorage.clear();
    }

    /** Removes all nested backup keys (cleanup utility for the infinite nesting bug) */
    cleanupNestedBackups(): number {
        this.checkBufferedStorageInitialized();
        const allKeys = this._storage.getAllKeys();

        // Find keys with multiple "backup:" prefixes (nested backups)
        const nestedBackupKeys = allKeys.filter((key) => {
            const branchName = getBranchNameFromStorageKey(key);
            if (!branchName) {
                return false;
            }

            // Count occurrences of "backup:" - if more than 1, it's nested
            const backupCount = (branchName.match(/backup:/g) || []).length;
            return backupCount > 1;
        });

        // Remove all nested backups
        nestedBackupKeys.forEach((key) => {
            const branchName = getBranchNameFromStorageKey(key);
            if (branchName) {
                this._storage.remove(branchName);
            }
        });

        console.debug(`[NavigationStorage] Cleaned up ${nestedBackupKeys.length} nested backup keys`);
        return nestedBackupKeys.length;
    }

    /**
     * Returns just branch names, WITHOUT loading full snapshots into memory.
     * Much more memory-efficient than getAllStoredBranches().
     */
    getAllStoredBranchNames(): string[] {
        this.checkBufferedStorageInitialized();
        return (
            this._storage
                .getAllKeys()
                .map((key) => getBranchNameFromStorageKey(key))
                .filter((key) => key !== undefined)
                // Backup keys have format "backup:v1:branchName" and should never be loaded as branches
                .filter((key) => !key.startsWith("backup:")) as string[]
        );
    }

    /**
     * Returns lightweight metadata for all branches WITHOUT loading full snapshots.
     * For BufferedStorage, loads directly from persistent storage to avoid polluting cache.
     * Much more memory-efficient than getAllStoredBranches().
     */
    async getAllStoredBranchMetadata(): Promise<BranchMetadata[]> {
        this.checkBufferedStorageInitialized();
        const branchNames = this.getAllStoredBranchNames();

        // For BufferedStorage, use specialized method to bypass cache
        if (this.isBufferedStorage(this._storage)) {
            const storage = this._storage as BufferedIndexedDBStorage;
            const results = await Promise.all(
                branchNames.map(async (branchName) => {
                    try {
                        const metadata = await storage.getMetadataOnly(branchName);
                        if (!metadata) {
                            return null;
                        }
                        return { branchName, metadata };
                    } catch (error) {
                        console.error(`Failed to load metadata for branch ${branchName}:`, error);
                        return null;
                    }
                })
            );
            return results.filter((item) => item != null) as BranchMetadata[];
        }

        // For synchronous storage, read directly (already in memory)
        return branchNames
            .map((branchName) => {
                try {
                    const serialized = this._storage.get(branchName);
                    if (!serialized) {
                        return null;
                    }

                    const parsed = JSON.parse(serialized);
                    return {
                        branchName,
                        metadata: {
                            orgName: parsed.metadata?.orgName ?? "",
                            docsUrl: parsed.metadata?.docsUrl ?? "",
                            prTitle: parsed.metadata?.prTitle,
                            prUrl: parsed.metadata?.prUrl
                        }
                    };
                } catch (error) {
                    console.error(`Failed to parse metadata for branch ${branchName}:`, error);
                    return null;
                }
            })
            .filter((item) => item != null) as BranchMetadata[];
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

/**
 * BufferedStorage extends Storage with asynchronous initialization and optional preloading.
 * Used for storage backends that require async setup (e.g., IndexedDB).
 */
interface BufferedStorage extends Storage {
    /** Initialize the storage backend. Optionally preload a specific key into cache. */
    init(keyToPreload?: string): Promise<void>;
    /** Check if init() has completed. */
    isInitialized(): boolean;
}

class LocalStorage implements Storage {
    constructor(private readonly _storageKey: string) {}

    private get isAvailable(): boolean {
        return typeof window !== "undefined" && typeof localStorage !== "undefined";
    }

    private safeOperation<T>(operation: () => T, fallback: T): T {
        if (!this.isAvailable) {
            return fallback;
        }
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
 * Key features:
 * - In-memory cache: stores loaded data for synchronous access
 * - Lazy loading: only loads requested keys on-demand
 * - Synchronous API: get/set operations work with in-memory cache
 * - Background persistence: writes are debounced and batched to IndexedDB
 * - Graceful fallback: works in-memory-only if IndexedDB is unavailable
 *
 * Note: Each instance typically serves a single branch, so cache size is naturally limited.
 */
class BufferedIndexedDBStorage implements BufferedStorage {
    private readonly dbName = "fern-navigation-storage";
    private readonly storeName = "navigation";
    private readonly version = 1;
    private cache = new Map<string, string>();
    private availableKeys = new Set<string>();
    private preloadedKey: string | null = null;
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

    async init(keyToPreload?: string): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
            if (keyToPreload) {
                await this._preloadKey(keyToPreload);
            }
            return;
        }

        if (!this.isAvailable) {
            console.warn("IndexedDB not available, using in-memory cache only");
            this._initialized = true;
            return Promise.resolve();
        }

        this.initPromise = this._initDB(keyToPreload);
        return this.initPromise;
    }

    /** Returns whether the storage has been initialized */
    isInitialized(): boolean {
        return this._initialized;
    }

    private async _initDB(keyToPreload?: string): Promise<void> {
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

            // Verify store exists before using it - if not, re-initialize
            // This can happen if user manually cleared the database
            if (!this.db.objectStoreNames.contains(this.storeName)) {
                console.warn(
                    `Object store "${this.storeName}" not found in database version ${this.version}. Re-initializing...`
                );
                this.db.close();

                // Delete and recreate database
                await new Promise<void>((resolve, reject) => {
                    const deleteRequest = indexedDB.deleteDatabase(this.dbName);
                    deleteRequest.onsuccess = () => resolve();
                    deleteRequest.onerror = () =>
                        reject(new Error(deleteRequest.error?.toString() ?? "Failed to delete database"));
                });

                // Re-open with same version, which will trigger onupgradeneeded
                const request = indexedDB.open(this.dbName, this.version);
                this.db = await new Promise<IDBDatabase>((resolve, reject) => {
                    request.onerror = () => reject(new Error(request.error?.toString() ?? "IndexedDB failed to open"));
                    request.onsuccess = () => resolve(request.result);
                    request.onupgradeneeded = (event) => {
                        const db = (event.target as IDBOpenDBRequest).result;
                        if (!db.objectStoreNames.contains(this.storeName)) {
                            db.createObjectStore(this.storeName);
                        }
                    };
                });
            }

            await this._preloadKeys();

            if (keyToPreload) {
                await this._preloadKey(keyToPreload);
                this.preloadedKey = keyToPreload;
            }
        } catch (error) {
            console.error("Failed to initialize IndexedDB:", error);
            // Continue with in-memory cache only
        } finally {
            this._initialized = true;
        }
    }

    private async _preloadKeys(): Promise<void> {
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

            // Store only keys, not values
            keys.forEach((key) => {
                if (typeof key === "string" && key.startsWith(this._storageKey)) {
                    this.availableKeys.add(key);
                }
            });
        } catch (error) {
            console.error("Failed to preload keys from IndexedDB:", error);
        }
    }

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

    private _scheduleWrite(): void {
        if (this.writeTimer != null) {
            clearTimeout(this.writeTimer);
        }

        this.writeTimer = setTimeout(() => {
            void this._flushWrites();
        }, 100);
    }

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

    /**
     * Retrieves a value from the in-memory cache.
     *
     * Behavior:
     * - Returns cached value if present
     * - Returns null if key doesn't exist in IndexedDB
     * - Throws error only if the explicitly preloaded key exists in IndexedDB but failed to cache
     */
    get(key: string): string | null {
        const fullKey = this.getFullKey(key);
        const value = this.cache.get(fullKey);

        // If not in cache but exists in IndexedDB, warn and return null
        // This handles backup checks during migrations and other incidental key accesses
        if (!value && this.availableKeys.has(fullKey)) {
            console.warn(
                `[BufferedIndexedDBStorage] Key "${key}" exists in IndexedDB but not in cache. ` +
                    `Returning null. Preloaded key: ${this.preloadedKey ?? "none"}`
            );
            return null;
        }

        return value ?? null;
    }

    private _addToCache(fullKey: string, value: string): void {
        this.cache.set(fullKey, value);
    }

    set(key: string, value: string): void {
        const fullKey = this.getFullKey(key);

        this.availableKeys.add(fullKey);
        this._addToCache(fullKey, value);

        // Track that this key is now accessible (was written, not just preloaded)
        if (!this.preloadedKey) {
            this.preloadedKey = key;
        }

        if (this.db) {
            this.pendingWrites.set(fullKey, value);
            this._scheduleWrite();
        }
    }

    remove(key: string): void {
        const fullKey = this.getFullKey(key);

        this.availableKeys.delete(fullKey);
        this.cache.delete(fullKey);

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
        // Clear from all tracking structures
        const keysToDelete = Array.from(this.availableKeys).filter((k) => k.startsWith(this._storageKey));

        keysToDelete.forEach((key) => {
            this.availableKeys.delete(key);
            this.cache.delete(key);
        });

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

    getAllKeys(): string[] {
        return Array.from(this.availableKeys);
    }

    private async _preloadKey(key: string): Promise<void> {
        const fullKey = this.getFullKey(key);

        if (!this.availableKeys.has(fullKey) || !this.db) {
            return;
        }

        try {
            const value = await this._getFromDB(fullKey);
            if (value) {
                this._addToCache(fullKey, value);
            }
        } catch (error) {
            console.error(`Failed to preload key ${key}:`, error);
        }
    }

    /**
     * Loads only metadata from IndexedDB without caching the full snapshot.
     * Parses the JSON to extract just orgName and docsUrl fields.
     */
    async getMetadataOnly(
        branchName: string
    ): Promise<{ orgName: string; docsUrl: string; prTitle?: string; prUrl?: string } | null> {
        const fullKey = this.getFullKey(branchName);

        if (!this.availableKeys.has(fullKey) || !this.db) {
            return null;
        }

        try {
            const serialized = await this._getFromDB(fullKey);
            if (!serialized) {
                return null;
            }

            const parsed = JSON.parse(serialized);
            const metadata = parsed?.metadata;

            if (!metadata || typeof metadata !== "object") {
                console.warn(`Invalid metadata structure for branch ${branchName}`);
                return null;
            }

            return {
                orgName: typeof metadata.orgName === "string" ? metadata.orgName : "",
                docsUrl: typeof metadata.docsUrl === "string" ? metadata.docsUrl : "",
                prTitle: typeof metadata.prTitle === "string" ? metadata.prTitle : undefined,
                prUrl: typeof metadata.prUrl === "string" ? metadata.prUrl : undefined
            };
        } catch (error) {
            console.error(`Failed to load metadata for ${branchName}:`, error);
            return null;
        }
    }
}
