import type { FSItem } from "~/domain/storage";
import type { AttachmentsStatus } from "~/domain/resume";
import { computeAttachmentsStatus } from "~/domain/resume";
import { STORE_FILES, StorageUnavailableError, StorageTransactionError, getDB } from "./idb";
const buildItem = (path: string, blob: Blob, name: string): FSItem & { blob: Blob } => ({
    id: Math.random().toString(36).substring(2),
    uid: "local",
    name,
    path,
    is_dir: false,
    parent_id: "root",
    parent_uid: "local",
    created: Date.now(),
    modified: Date.now(),
    accessed: Date.now(),
    size: blob.size,
    writable: true,
    blob,
});

export const saveLocalBlob = async (path: string, blob: Blob, name: string): Promise<FSItem> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FILES, "readwrite");
        const store = tx.objectStore(STORE_FILES);
        const item = buildItem(path, blob, name);

        tx.oncomplete = () => resolve(item);
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));

        const req = store.put(item);
        req.onerror = () => reject(req.error ?? new Error("Failed to store blob"));
    });
};

export const getLocalBlob = async (path: string): Promise<Blob | undefined> => {
    // Only allow same-origin relative paths (e.g. bundled static assets)
    if (path.startsWith("/") && !path.startsWith("//")) {
        try {
            const res = await fetch(path);
            if (res.ok) return await res.blob();
        } catch {
            // Ignore and fall through to IndexedDB
        }
    }

    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FILES, "readonly");
        const store = tx.objectStore(STORE_FILES);
        const req = store.get(path);
        req.onsuccess = () => {
            const result = req.result as (FSItem & { blob?: Blob }) | undefined;
            resolve(result?.blob);
        };
        req.onerror = () => reject(new StorageTransactionError(req.error?.message));
    });
};

export const hasLocalBlob = async (path: string): Promise<boolean> => {
    if (!path) return false;
    const db = await getDB();
    return new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_FILES, "readonly");
        const store = tx.objectStore(STORE_FILES);
        const req = store.count(path);
        req.onsuccess = () => resolve((req.result || 0) > 0);
        req.onerror = () => reject(new StorageTransactionError(req.error?.message));
    });
};

export const checkAttachmentsStatus = async (
    resumePath?: string,
    imagePath?: string,
): Promise<AttachmentsStatus> => {
    if (!resumePath && !imagePath) return "missing";
    try {
        const db = await getDB();
        return new Promise<AttachmentsStatus>((resolve, reject) => {
            const tx = db.transaction(STORE_FILES, "readonly");
            const store = tx.objectStore(STORE_FILES);
            let hasPdf = false;
            let hasImg = false;
            let pending = 0;

            const checkDone = () => {
                pending--;
                if (pending === 0) {
                    resolve(computeAttachmentsStatus(hasPdf, hasImg));
                }
            };

            if (resumePath) {
                pending++;
                const req1 = store.count(resumePath);
                req1.onsuccess = () => {
                    hasPdf = (req1.result || 0) > 0;
                    checkDone();
                };
                req1.onerror = () => reject(new StorageTransactionError(req1.error?.message));
            }

            if (imagePath) {
                pending++;
                const req2 = store.count(imagePath);
                req2.onsuccess = () => {
                    hasImg = (req2.result || 0) > 0;
                    checkDone();
                };
                req2.onerror = () => reject(new StorageTransactionError(req2.error?.message));
            }

            if (pending === 0) {
                resolve("missing");
            }
        });
    } catch (err) {
        if (err instanceof StorageUnavailableError || err instanceof StorageTransactionError) {
            return "unavailable";
        }
        return "missing";
    }
};

export const deleteLocalBlob = async (path: string): Promise<boolean> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_FILES, "readwrite");
            const store = tx.objectStore(STORE_FILES);
            let existed = false;
            tx.oncomplete = () => resolve(existed);
            tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
            tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
            // `delete()` succeeds even for a missing key, so check existence first
            // and report whether a row was actually removed.
            const getReq = store.getKey(path);
            getReq.onsuccess = () => {
                if (getReq.result === undefined || getReq.result === null) return;
                existed = true;
                const delReq = store.delete(path);
                delReq.onerror = () => reject(delReq.error ?? new Error("Failed to delete blob"));
            };
            getReq.onerror = () => reject(getReq.error ?? new Error("Failed to look up blob"));
        });
    } catch {
        return false;
    }
};

export const listLocalBlobs = async (): Promise<FSItem[]> => {
    try {
        const db = await getDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_FILES, "readonly");
            const store = tx.objectStore(STORE_FILES);
            const req = store.getAll();
            req.onsuccess = () => resolve((req.result || []) as FSItem[]);
            req.onerror = () => {
                console.warn("IndexedDB list failed:", req.error);
                resolve([]);
            };
        });
    } catch {
        return [];
    }
};

export const clearAllBlobs = async (uid = "local"): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FILES, "readwrite");
        const store = tx.objectStore(STORE_FILES);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Failed to clear blobs"));
        tx.onabort = () => reject(tx.error ?? new Error("Failed to clear blobs"));

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
                if (cursor.value && cursor.value.uid === uid) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
        cursorReq.onerror = () => reject(cursorReq.error ?? new Error("Failed to clear blobs"));
    });
};
// ---------------------------------------------------------------------------
// Storage Quota, Backup Export & Full Restore with Blobs
// ---------------------------------------------------------------------------

export interface StorageEstimateInfo {
    usageBytes: number;
    quotaBytes: number;
    percentUsed: number;
    usageMB: string;
    quotaMB: string;
}

export const estimateStorageQuota = async (): Promise<StorageEstimateInfo | null> => {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
        try {
            const { usage = 0, quota = 0 } = await navigator.storage.estimate();
            const percentUsed = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
            return {
                usageBytes: usage,
                quotaBytes: quota,
                percentUsed,
                usageMB: (usage / (1024 * 1024)).toFixed(2),
                quotaMB: (quota / (1024 * 1024)).toFixed(0),
            };
        } catch {
            return null;
        }
    }
    return null;
};
