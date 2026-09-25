import type { FSItem } from "~/domain/storage";
import type { Resume, ResumeHeader, AttachmentsStatus } from "~/domain/resume";
import { buildResumeHeader, computeAttachmentsStatus } from "~/domain/resume";
import { isStaleWrite } from "~/lib/tabsync";
import { migrateResume } from "~/lib/migrations";

const DB_NAME = "cvision_local_db";
const DB_VERSION = 2;
const STORE_FILES = "files";
const STORE_RESUMES = "resumes";

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
    imagePath?: string
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
            tx.oncomplete = () => resolve(true);
            tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
            tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
            const req = store.delete(path);
            req.onerror = () => reject(req.error ?? new Error("Failed to delete blob"));
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
    expectedVersion?: number
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
                putReq.onerror = () => reject(putReq.error ?? new Error("Failed to save resume entity"));
            };
            getReq.onerror = () => reject(getReq.error ?? new Error("Failed to read existing resume"));
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
            req.onsuccess = () => {
                const raw = req.result as unknown;
                if (!raw) {
                    resolve(null);
                    return;
                }
                const migrated = migrateResume(raw);
                if (migrated && (raw as Resume).schemaVersion !== migrated.schemaVersion) {
                    saveResumeEntity(migrated).catch(() => {});
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
            const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;
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

export const blobToBase64 = async (blob: Blob): Promise<string> => {
    if (typeof FileReader !== "undefined") {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === "string") {
                    resolve(reader.result);
                } else {
                    reject(new Error("Failed to convert blob to data URL"));
                }
            };
            reader.onerror = () => reject(reader.error || new Error("FileReader error"));
            reader.readAsDataURL(blob);
        });
    }
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = blob.type || "application/octet-stream";
    return `data:${mimeType};base64,${base64}`;
};

export const base64ToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(";base64,");
    const mimeType = parts[0]?.replace("data:", "") || "application/octet-stream";
    const rawBase64 = parts[1] || parts[0];

    if (typeof Buffer !== "undefined") {
        const buffer = Buffer.from(rawBase64, "base64");
        return new Blob([buffer], { type: mimeType });
    }

    const binary = atob(rawBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
};

export interface ResumeBackupItem {
    entity: Resume;
    pdfBase64?: string;
    imageBase64?: string;
}

export interface FullBackupPayload {
    version: number;
    exportedAt: number;
    resumes: ResumeBackupItem[];
}

export const exportAllResumeData = async (): Promise<FullBackupPayload> => {
    try {
        const db = await getDB();
        const rawResumes = await new Promise<Resume[]>((resolve) => {
            const tx = db.transaction(STORE_RESUMES, "readonly");
            const store = tx.objectStore(STORE_RESUMES);
            const req = store.getAll();
            req.onsuccess = () => resolve((req.result || []) as Resume[]);
            req.onerror = () => resolve([]);
        });

        const items: ResumeBackupItem[] = [];
        for (const resume of rawResumes) {
            let pdfBase64: string | undefined;
            let imageBase64: string | undefined;

            try {
                if (resume.resumePath) {
                    const pdfBlob = await getLocalBlob(resume.resumePath);
                    if (pdfBlob) pdfBase64 = await blobToBase64(pdfBlob);
                }
                if (resume.imagePath) {
                    const imageBlob = await getLocalBlob(resume.imagePath);
                    if (imageBlob) imageBase64 = await blobToBase64(imageBlob);
                }
            } catch {
                // Ignore individual blob read errors
            }

            items.push({ entity: resume, pdfBase64, imageBase64 });
        }

        return {
            version: 2,
            exportedAt: Date.now(),
            resumes: items,
        };
    } catch {
        return {
            version: 2,
            exportedAt: Date.now(),
            resumes: [],
        };
    }
};

import {
    MAX_BACKUP_RESUMES,
    MAX_BACKUP_TOTAL_BYTES,
    MAX_INDIVIDUAL_BLOB_BYTES,
} from "../limits";

export { MAX_BACKUP_RESUMES, MAX_BACKUP_TOTAL_BYTES, MAX_INDIVIDUAL_BLOB_BYTES };

const SAFE_LOCAL_PATH_REGEX = /^local:\/\/[a-zA-Z0-9_\-\.\/]+$/;

export const estimateBase64Bytes = (dataUrl: unknown): number => {
    if (typeof dataUrl !== "string" || !dataUrl) return 0;
    const rawBase64 = dataUrl.split(";base64,")[1] || dataUrl;
    return Math.ceil((rawBase64.length * 3) / 4);
};

export const isValidLocalPath = (path: unknown): path is string => {
    if (typeof path !== "string") return false;
    if (path.length === 0 || path.length > 255) return false;
    if (!SAFE_LOCAL_PATH_REGEX.test(path)) return false;
    if (path.includes("..") || path.includes("//", 8)) return false;
    return true;
};

export const isValidPdfBase64 = (dataUrl: unknown): boolean => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:application/pdf;base64,")) return false;
    try {
        const rawBase64 = dataUrl.split(";base64,")[1] || "";
        if (!rawBase64) return false;
        const binaryPrefix = typeof atob !== "undefined"
            ? atob(rawBase64.slice(0, 32))
            : Buffer.from(rawBase64.slice(0, 32), "base64").toString("binary");
        return binaryPrefix.startsWith("%PDF-");
    } catch {
        return false;
    }
};

export const isValidImageBase64 = (dataUrl: unknown): boolean => {
    if (typeof dataUrl !== "string") return false;
    const isPng = dataUrl.startsWith("data:image/png;base64,");
    const isJpeg = dataUrl.startsWith("data:image/jpeg;base64,") || dataUrl.startsWith("data:image/jpg;base64,");
    const isWebp = dataUrl.startsWith("data:image/webp;base64,");
    if (!isPng && !isJpeg && !isWebp) return false;

    const rawBase64 = dataUrl.split(";base64,")[1] || "";
    if (rawBase64.length < 16) return false;

    try {
        const binary = typeof atob !== "undefined"
            ? atob(rawBase64.slice(0, 48))
            : Buffer.from(rawBase64.slice(0, 48), "base64").toString("binary");

        if (isPng) {
            // PNG signature: 89 50 4E 47 0D 0A 1A 0A
            return (
                binary.charCodeAt(0) === 0x89 &&
                binary.slice(1, 4) === "PNG" &&
                binary.charCodeAt(4) === 0x0D &&
                binary.charCodeAt(5) === 0x0A &&
                binary.charCodeAt(6) === 0x1A &&
                binary.charCodeAt(7) === 0x0A
            );
        }

        if (isJpeg) {
            // JPEG signature: FF D8 FF
            return (
                binary.charCodeAt(0) === 0xFF &&
                binary.charCodeAt(1) === 0xD8 &&
                binary.charCodeAt(2) === 0xFF
            );
        }

        if (isWebp) {
            // WebP signature: "RIFF" at offset 0..3 and "WEBP" at offset 8..11
            return binary.slice(0, 4) === "RIFF" && binary.slice(8, 12) === "WEBP";
        }

        return false;
    } catch {
        return false;
    }
};

export interface ImportBackupResult {
    success: boolean;
    total: number;
    restored: number;
    skipped: number;
    warnings: string[];
    errors: string[];
}

/**
 * Restores a full backup payload into IndexedDB (files + resumes)
 * with pre-decode size estimation, magic byte validation, collision avoidance and atomic rollback per element.
 */
export const importBackupData = async (payload: unknown): Promise<ImportBackupResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!payload || typeof payload !== "object") {
        return { success: false, total: 0, restored: 0, skipped: 0, warnings: [], errors: ["Invalid backup payload format"] };
    }

    const data = payload as Partial<FullBackupPayload>;
    if (!Array.isArray(data.resumes) || data.resumes.length === 0) {
        return { success: false, total: 0, restored: 0, skipped: 0, warnings: [], errors: ["Backup contains no resumes"] };
    }

    const total = data.resumes.length;
    if (total > MAX_BACKUP_RESUMES) {
        return {
            success: false,
            total,
            restored: 0,
            skipped: total,
            warnings: [],
            errors: [`Backup exceeds maximum allowed resumes (${MAX_BACKUP_RESUMES})`],
        };
    }

    // Phase 1: Staging, runtime type validation, pre-decode size validation and strict signature inspection
    interface StagedItem {
        entity: Resume;
        pdfBlob?: Blob;
        imageBlob?: Blob;
    }
    const staged: StagedItem[] = [];
    let skipped = 0;
    let totalBackupBytes = 0;

    for (let i = 0; i < data.resumes.length; i++) {
        const item = data.resumes[i];
        if (
            !item ||
            typeof item !== "object" ||
            !item.entity ||
            typeof item.entity !== "object" ||
            typeof item.entity.id !== "string" ||
            item.entity.id.trim().length === 0
        ) {
            skipped++;
            errors.push(`Item #${i + 1}: Invalid resume entity structure`);
            continue;
        }

        const migrated = migrateResume(item.entity);
        if (!migrated) {
            skipped++;
            errors.push(`Item #${i + 1} (${item.entity.id}): Failed schema migration validation`);
            continue;
        }

        if (!isValidLocalPath(migrated.resumePath) || (migrated.imagePath && !isValidLocalPath(migrated.imagePath))) {
            skipped++;
            errors.push(`Item #${i + 1} (${migrated.id}): Forbidden or insecure path`);
            continue;
        }

        let pdfBlob: Blob | undefined;
        if (item.pdfBase64 !== undefined) {
            if (typeof item.pdfBase64 !== "string") {
                skipped++;
                errors.push(`Item #${i + 1} (${migrated.id}): Invalid PDF payload type`);
                continue;
            }
            const pdfBytes = estimateBase64Bytes(item.pdfBase64);
            if (pdfBytes > MAX_INDIVIDUAL_BLOB_BYTES) {
                skipped++;
                errors.push(`Item #${i + 1} (${migrated.id}): PDF exceeds size limit (${(MAX_INDIVIDUAL_BLOB_BYTES / 1024 / 1024).toFixed(0)} MB)`);
                continue;
            }
            totalBackupBytes += pdfBytes;
            if (totalBackupBytes > MAX_BACKUP_TOTAL_BYTES) {
                return {
                    success: false,
                    total,
                    restored: 0,
                    skipped: total,
                    warnings,
                    errors: [`Backup total payload exceeds maximum allowed size (${(MAX_BACKUP_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB)`],
                };
            }

            if (!isValidPdfBase64(item.pdfBase64)) {
                skipped++;
                errors.push(`Item #${i + 1} (${migrated.id}): Invalid or corrupt PDF signature`);
                continue;
            }
            pdfBlob = base64ToBlob(item.pdfBase64);
        }

        let imageBlob: Blob | undefined;
        if (item.imageBase64 !== undefined) {
            if (typeof item.imageBase64 !== "string") {
                skipped++;
                errors.push(`Item #${i + 1} (${migrated.id}): Invalid preview image payload type`);
                continue;
            }
            const imageBytes = estimateBase64Bytes(item.imageBase64);
            if (imageBytes > MAX_INDIVIDUAL_BLOB_BYTES) {
                skipped++;
                errors.push(`Item #${i + 1} (${migrated.id}): Image exceeds size limit (${(MAX_INDIVIDUAL_BLOB_BYTES / 1024 / 1024).toFixed(0)} MB)`);
                continue;
            }
            totalBackupBytes += imageBytes;
            if (totalBackupBytes > MAX_BACKUP_TOTAL_BYTES) {
                return {
                    success: false,
                    total,
                    restored: 0,
                    skipped: total,
                    warnings,
                    errors: [`Backup total payload exceeds maximum allowed size (${(MAX_BACKUP_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB)`],
                };
            }

            if (!isValidImageBase64(item.imageBase64)) {
                skipped++;
                errors.push(`Item #${i + 1} (${migrated.id}): Invalid preview image format or magic bytes`);
                continue;
            }
            imageBlob = base64ToBlob(item.imageBase64);
        }

        if (!item.pdfBase64 && migrated.resumePath) {
            warnings.push(`Item #${i + 1} (${migrated.id}): Restored metadata without attached PDF file`);
        }

        staged.push({ entity: migrated, pdfBlob, imageBlob });
    }

    if (staged.length === 0) {
        return { success: false, total, restored: 0, skipped, warnings, errors };
    }

    // Phase 2: Commit staged items with comprehensive collision resolution & per-item rollback
    let restored = 0;
    for (const item of staged) {
        const createdBlobPaths: string[] = [];
        try {
            // Zero-allocation collision checks (counts keys without loading multi-MB blobs into memory)
            const entityCollides = await hasResumeEntity(item.entity.id);
            const pdfCollides = item.entity.resumePath ? await hasLocalBlob(item.entity.resumePath) : false;
            const imgCollides = item.entity.imagePath ? await hasLocalBlob(item.entity.imagePath) : false;

            let targetId = item.entity.id;
            let targetResumePath = item.entity.resumePath;
            let targetImagePath = item.entity.imagePath;

            if (entityCollides || pdfCollides || imgCollides) {
                const freshId = typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                targetId = freshId;
                targetResumePath = `local://resumes/${freshId}.pdf`;
                targetImagePath = `local://resumes/${freshId}.png`;
            }

            item.entity.id = targetId;
            item.entity.resumePath = targetResumePath;
            item.entity.imagePath = targetImagePath;

            if (item.pdfBlob) {
                await saveLocalBlob(targetResumePath, item.pdfBlob, `${targetId}.pdf`);
                createdBlobPaths.push(targetResumePath);
            }
            if (item.imageBlob) {
                await saveLocalBlob(targetImagePath, item.imageBlob, `${targetId}.png`);
                createdBlobPaths.push(targetImagePath);
            }

            item.entity.attachmentsStatus = computeAttachmentsStatus(
                Boolean(item.pdfBlob),
                Boolean(item.imageBlob)
            );

            const saveRes = await saveResumeEntity(item.entity);
            if (saveRes.success) {
                const header = buildResumeHeader(saveRes.entity);
                try {
                    if (typeof localStorage !== "undefined") {
                        localStorage.setItem(`resume:${targetId}`, JSON.stringify(header));
                    }
                } catch {
                    // localStorage best-effort
                }
                restored++;
            } else {
                // Rollback created blobs for this item
                for (const p of createdBlobPaths) {
                    await deleteLocalBlob(p).catch(() => {});
                }
                skipped++;
                errors.push(`Resume ${targetId}: Failed to save to database`);
            }
        } catch (err) {
            for (const p of createdBlobPaths) {
                await deleteLocalBlob(p).catch(() => {});
            }
            skipped++;
            errors.push(`Resume ${item.entity.id}: Commit failed (${String(err)})`);
        }
    }

    if (errors.length > 0) {
        runStorageGarbageCollector().catch(() => {});
    }

    return {
        success: restored > 0,
        total,
        restored,
        skipped,
        warnings,
        errors,
    };
};

/**
 * Storage Garbage Collection:
 * Removes unreferenced blobs in STORE_FILES that are no longer associated with any Resume,
 * and prunes abandoned "processing" resume entities whose grace period has expired.
 */
export const runStorageGarbageCollector = async (
    gracePeriodMs = 30 * 60 * 1000
): Promise<{ deletedBlobs: number; deletedOrphanEntities: number }> => {
    try {
        const db = await getDB();
        const resumes = await new Promise<Resume[]>((resolve) => {
            const tx = db.transaction(STORE_RESUMES, "readonly");
            const store = tx.objectStore(STORE_RESUMES);
            const req = store.getAll();
            req.onsuccess = () => resolve((req.result || []) as Resume[]);
            req.onerror = () => resolve([]);
        });

        const now = Date.now();
        let deletedBlobs = 0;
        let deletedOrphanEntities = 0;
        const activeResumes: Resume[] = [];

        // 1. Detect and prune abandoned processing resumes
        for (const r of resumes) {
            if (r.status === "processing") {
                const lastActivity = r.heartbeatAt || r.updatedAt || r.processingStartedAt || 0;
                if (now - lastActivity >= gracePeriodMs) {
                    await deleteResumeEntity(r.id);
                    if (r.resumePath) {
                        const deleted = await deleteLocalBlob(r.resumePath).catch(() => false);
                        if (deleted) deletedBlobs++;
                    }
                    if (r.imagePath) {
                        const deleted = await deleteLocalBlob(r.imagePath).catch(() => false);
                        if (deleted) deletedBlobs++;
                    }
                    deletedOrphanEntities++;
                    continue;
                }
            }
            activeResumes.push(r);
        }

        const activePaths = new Set<string>();
        for (const r of activeResumes) {
            if (r.resumePath) activePaths.add(r.resumePath);
            if (r.imagePath) activePaths.add(r.imagePath);
        }

        const blobs = await listLocalBlobs();

        for (const blob of blobs) {
            if (!activePaths.has(blob.path)) {
                if (now - blob.created >= gracePeriodMs) {
                    await deleteLocalBlob(blob.path);
                    deletedBlobs++;
                }
            }
        }

        return { deletedBlobs, deletedOrphanEntities };
    } catch {
        return { deletedBlobs: 0, deletedOrphanEntities: 0 };
    }
};
