import type { Resume } from "~/domain/resume";
import { isStaleWrite } from "~/lib/tabsync";
import { migrateResume } from "~/lib/migrations";
import { STORE_RESUMES, StorageUnavailableError, StorageTransactionError, getDB } from "./idb";
// ---------------------------------------------------------------------------
// Full Resume Entity Storage in IndexedDB with Optimistic Concurrency
// ---------------------------------------------------------------------------

export interface SaveResumeResult {
    success: boolean;
    entity: Resume;
    reason?: "version_mismatch" | "stale_write" | "storage_error";
}

/**
 * Saves a full Resume entity to IndexedDB.
 * If expectedVersion is specified or existing data is newer, prevents stale overwrites.
 * Synchronizes and increments the version deterministically.
 */
export const saveResumeEntity = async (
    resume: Resume,
    expectedVersion?: number,
): Promise<SaveResumeResult> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_RESUMES, "readwrite");
            const store = tx.objectStore(STORE_RESUMES);
            let savedEntity: Resume | null = null;

            tx.oncomplete = () => {
                if (savedEntity) {
                    resolve({ success: true, entity: savedEntity });
                }
            };
            tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
            tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));

            const getReq = store.get(resume.id);
            getReq.onsuccess = () => {
                const existing = getReq.result as Resume | undefined;

                if (existing) {
                    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
                        return resolve({
                            success: false,
                            entity: existing,
                            reason: "version_mismatch",
                        });
                    }

                    if (isStaleWrite(resume, existing)) {
                        return resolve({
                            success: false,
                            entity: existing,
                            reason: "stale_write",
                        });
                    }
                }

                const nextVersion = Math.max(existing?.version || 0, resume.version || 0) + 1;
                const nextUpdatedAt = Date.now();

                const entity: Resume = {
                    ...resume,
                    version: nextVersion,
                    updatedAt: nextUpdatedAt,
                };

                savedEntity = entity;
                const putReq = store.put(entity);
                putReq.onerror = () =>
                    reject(putReq.error ?? new Error("Failed to save resume entity"));
            };
            getReq.onerror = () =>
                reject(getReq.error ?? new Error("Failed to read existing resume"));
        });
    } catch (err) {
        console.error("Failed to save resume entity to IndexedDB:", err);
        return {
            success: false,
            entity: resume,
            reason: "storage_error",
        };
    }
};

export const getResumeEntity = async (id: string): Promise<Resume | null> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_RESUMES, "readonly");
            const store = tx.objectStore(STORE_RESUMES);
            const req = store.get(id);
            req.onsuccess = async () => {
                const raw = req.result as unknown;
                if (!raw) {
                    resolve(null);
                    return;
                }
                const migrated = migrateResume(raw);
                if (migrated && (raw as Resume).schemaVersion !== migrated.schemaVersion) {
                    // Persist the migration with an optimistic version guard and
                    // return the *stored* entity, so callers get the version they
                    // must use for their own guarded save instead of silently
                    // losing their update to a version_mismatch.
                    const saved = await saveResumeEntity(migrated, (raw as Resume).version).catch(
                        () => null,
                    );
                    if (saved) {
                        resolve(migrateResume(saved.entity) ?? saved.entity);
                        return;
                    }
                }
                resolve(migrated);
            };
            req.onerror = () => reject(new StorageTransactionError(req.error?.message));
        });
    } catch (err) {
        if (err instanceof StorageUnavailableError || err instanceof StorageTransactionError) {
            console.error("IndexedDB getResumeEntity failed due to storage error:", err);
            throw err;
        }
        return null;
    }
};

export const hasResumeEntity = async (id: string): Promise<boolean> => {
    if (!id) return false;
    const db = await getDB();
    return new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_RESUMES, "readonly");
        const store = tx.objectStore(STORE_RESUMES);
        const req = store.count(id);
        req.onsuccess = () => resolve((req.result || 0) > 0);
        req.onerror = () => reject(new StorageTransactionError(req.error?.message));
    });
};

export const deleteResumeEntity = async (id: string): Promise<boolean> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_RESUMES, "readwrite");
            const store = tx.objectStore(STORE_RESUMES);
            tx.oncomplete = () => resolve(true);
            tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
            tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
            const req = store.delete(id);
            req.onerror = () => reject(req.error ?? new Error("Failed to delete resume entity"));
        });
    } catch {
        return false;
    }
};

export const clearAllResumeEntities = async (): Promise<void> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_RESUMES, "readwrite");
            const store = tx.objectStore(STORE_RESUMES);
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
            tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
            const req = store.clear();
            req.onerror = () => reject(req.error ?? new Error("Failed to clear resume entities"));
        });
    } catch {
        // Ignore
    }
};
