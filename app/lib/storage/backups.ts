import type { Resume } from "~/domain/resume";
import { buildResumeHeader, computeAttachmentsStatus } from "~/domain/resume";
import { migrateResume } from "~/lib/migrations";
import { STORE_RESUMES, getDB } from "./idb";
import { saveLocalBlob, getLocalBlob, hasLocalBlob, deleteLocalBlob } from "./blobs";
import { saveResumeEntity, hasResumeEntity } from "./resumes";
import { runStorageGarbageCollector } from "./gc";
import { MAX_BACKUP_RESUMES, MAX_BACKUP_TOTAL_BYTES, MAX_INDIVIDUAL_BLOB_BYTES } from "../limits";

export { MAX_BACKUP_RESUMES, MAX_BACKUP_TOTAL_BYTES, MAX_INDIVIDUAL_BLOB_BYTES };
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

        // Resumes are independent: read their blobs concurrently instead of
        // paying two round trips per record in sequence.
        const items: ResumeBackupItem[] = await Promise.all(
            rawResumes.map(async (resume) => {
                let pdfBase64: string | undefined;
                let imageBase64: string | undefined;

                try {
                    const [pdfBlob, imageBlob] = await Promise.all([
                        resume.resumePath ? getLocalBlob(resume.resumePath) : undefined,
                        resume.imagePath ? getLocalBlob(resume.imagePath) : undefined,
                    ]);
                    const [pdf, image] = await Promise.all([
                        pdfBlob ? blobToBase64(pdfBlob) : undefined,
                        imageBlob ? blobToBase64(imageBlob) : undefined,
                    ]);
                    pdfBase64 = pdf;
                    imageBase64 = image;
                } catch {
                    // Ignore individual blob read errors
                }

                return { entity: resume, pdfBase64, imageBase64 };
            }),
        );

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

const SAFE_LOCAL_PATH_REGEX = /^local:\/\/[a-zA-Z0-9_\-./]+$/;

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
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:application/pdf;base64,"))
        return false;
    try {
        const rawBase64 = dataUrl.split(";base64,")[1] || "";
        if (!rawBase64) return false;
        const binaryPrefix =
            typeof atob !== "undefined"
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
    const isJpeg =
        dataUrl.startsWith("data:image/jpeg;base64,") ||
        dataUrl.startsWith("data:image/jpg;base64,");
    const isWebp = dataUrl.startsWith("data:image/webp;base64,");
    if (!isPng && !isJpeg && !isWebp) return false;

    const rawBase64 = dataUrl.split(";base64,")[1] || "";
    if (rawBase64.length < 16) return false;

    try {
        const binary =
            typeof atob !== "undefined"
                ? atob(rawBase64.slice(0, 48))
                : Buffer.from(rawBase64.slice(0, 48), "base64").toString("binary");

        if (isPng) {
            // PNG signature: 89 50 4E 47 0D 0A 1A 0A
            return (
                binary.charCodeAt(0) === 0x89 &&
                binary.slice(1, 4) === "PNG" &&
                binary.charCodeAt(4) === 0x0d &&
                binary.charCodeAt(5) === 0x0a &&
                binary.charCodeAt(6) === 0x1a &&
                binary.charCodeAt(7) === 0x0a
            );
        }

        if (isJpeg) {
            // JPEG signature: FF D8 FF
            return (
                binary.charCodeAt(0) === 0xff &&
                binary.charCodeAt(1) === 0xd8 &&
                binary.charCodeAt(2) === 0xff
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
        return {
            success: false,
            total: 0,
            restored: 0,
            skipped: 0,
            warnings: [],
            errors: ["Invalid backup payload format"],
        };
    }

    const data = payload as Partial<FullBackupPayload>;
    if (!Array.isArray(data.resumes) || data.resumes.length === 0) {
        return {
            success: false,
            total: 0,
            restored: 0,
            skipped: 0,
            warnings: [],
            errors: ["Backup contains no resumes"],
        };
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

        if (
            !isValidLocalPath(migrated.resumePath) ||
            (migrated.imagePath && !isValidLocalPath(migrated.imagePath))
        ) {
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
                errors.push(
                    `Item #${i + 1} (${migrated.id}): PDF exceeds size limit (${(MAX_INDIVIDUAL_BLOB_BYTES / 1024 / 1024).toFixed(0)} MB)`,
                );
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
                    errors: [
                        `Backup total payload exceeds maximum allowed size (${(MAX_BACKUP_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB)`,
                    ],
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
                errors.push(
                    `Item #${i + 1} (${migrated.id}): Image exceeds size limit (${(MAX_INDIVIDUAL_BLOB_BYTES / 1024 / 1024).toFixed(0)} MB)`,
                );
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
                    errors: [
                        `Backup total payload exceeds maximum allowed size (${(MAX_BACKUP_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB)`,
                    ],
                };
            }

            if (!isValidImageBase64(item.imageBase64)) {
                skipped++;
                errors.push(
                    `Item #${i + 1} (${migrated.id}): Invalid preview image format or magic bytes`,
                );
                continue;
            }
            imageBlob = base64ToBlob(item.imageBase64);
        }

        if (!item.pdfBase64 && migrated.resumePath) {
            warnings.push(
                `Item #${i + 1} (${migrated.id}): Restored metadata without attached PDF file`,
            );
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
            const pdfCollides = item.entity.resumePath
                ? await hasLocalBlob(item.entity.resumePath)
                : false;
            const imgCollides = item.entity.imagePath
                ? await hasLocalBlob(item.entity.imagePath)
                : false;

            let targetId = item.entity.id;
            let targetResumePath = item.entity.resumePath;
            let targetImagePath = item.entity.imagePath;

            if (entityCollides || pdfCollides || imgCollides) {
                const freshId =
                    typeof crypto !== "undefined" && crypto.randomUUID
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
                Boolean(item.imageBlob),
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
