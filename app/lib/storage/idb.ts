export const DB_NAME = "cvision_local_db";
export const DB_VERSION = 2;
export const STORE_FILES = "files";
export const STORE_RESUMES = "resumes";

// Distinguishable storage errors so the UI can tell "file not found" apart from
// "storage unavailable / corrupted / blocked".
export class StorageUnavailableError extends Error {
    constructor(message = "Browser storage is unavailable") {
        super(message);
        this.name = "StorageUnavailableError";
    }
}

export class StorageTransactionError extends Error {
    constructor(message = "Browser storage operation failed") {
        super(message);
        this.name = "StorageTransactionError";
    }
}

// Test-only fault injection: `runStorageGarbageCollector` must never treat a
// failed listing as "there are no resumes", because that deletes live blobs.
// IndexedDB requests cannot be failed externally, so tests can flag the next
// `getAll` on a store here.
let forcedListingFailure = false;

export const __setForcedListingFailure = (value: boolean): void => {
    forcedListingFailure = value;
};

export const consumeForcedListingFailure = (): boolean => {
    const forced = forcedListingFailure;
    forcedListingFailure = false;
    return forced;
};

export const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            return reject(new StorageUnavailableError("IndexedDB is not available"));
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_FILES)) {
                db.createObjectStore(STORE_FILES, { keyPath: "path" });
            }
            if (!db.objectStoreNames.contains(STORE_RESUMES)) {
                db.createObjectStore(STORE_RESUMES, { keyPath: "id" });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            // Close the connection if a newer version of the database is opened elsewhere.
            db.onversionchange = () => db.close();
            resolve(db);
        };
        request.onerror = () => reject(new StorageUnavailableError(request.error?.message));
        request.onblocked = () =>
            reject(new StorageUnavailableError("IndexedDB open blocked by another connection"));
    });
};
