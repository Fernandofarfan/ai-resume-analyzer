import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import {
    blobToBase64,
    base64ToBlob,
    isValidLocalPath,
    isValidPdfBase64,
    isValidImageBase64,
    estimateBase64Bytes,
    saveLocalBlob,
    getLocalBlob,
    hasLocalBlob,
    deleteLocalBlob,
    listLocalBlobs,
    saveResumeEntity,
    getResumeEntity,
    hasResumeEntity,
    deleteResumeEntity,
    clearAllResumeEntities,
    clearAllBlobs,
    exportAllResumeData,
    importBackupData,
    runStorageGarbageCollector,
    checkAttachmentsStatus,
    getDB,
    MAX_BACKUP_RESUMES,
} from "./indexeddb";
import { buildResumeHeader } from "../../domain/resume";
import type { Resume } from "../../domain/resume";
import { kvList, kvSet } from "./kv";

const SAMPLE_PDF_BASE64 =
    "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCA1IDAgUiA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDcyIDcxMiBUZCAoVGVzdCBSZXN1bWUpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoK";

const SAMPLE_PNG_BASE64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErmCC";

describe("IndexedDB Storage & Backup Integration Tests", () => {
    // The suite runs in Node, where localStorage does not exist; kv.ts probes it
    // lazily, so installing an in-memory shim here exercises the real index path.
    const holder = globalThis as { localStorage?: unknown };
    let originalLocalStorage: unknown;
    let hadLocalStorage = false;

    beforeAll(() => {
        const data = new Map<string, string>();
        const shim = {
            get length() {
                return data.size;
            },
            key: (i: number) => Array.from(data.keys())[i] ?? null,
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => void data.set(k, String(v)),
            removeItem: (k: string) => void data.delete(k),
            clear: () => data.clear(),
        };
        hadLocalStorage = "localStorage" in holder;
        originalLocalStorage = holder.localStorage;
        holder.localStorage = shim;
    });

    afterAll(() => {
        if (hadLocalStorage) holder.localStorage = originalLocalStorage;
        else delete holder.localStorage;
    });

    beforeEach(async () => {
        await clearAllResumeEntities();
        await clearAllBlobs();
        if (typeof localStorage !== "undefined") localStorage.clear();
    });

    it("converts blob to base64 and restores it losslessly", async () => {
        const originalContent =
            "CVision AI test document buffer with special characters: áéíóú 12345";
        const originalBlob = new Blob([originalContent], { type: "application/pdf" });

        const base64 = await blobToBase64(originalBlob);
        expect(base64.startsWith("data:application/pdf;base64,")).toBe(true);

        const restoredBlob = base64ToBlob(base64);
        expect(restoredBlob.type).toBe("application/pdf");
        expect(restoredBlob.size).toBe(originalBlob.size);

        const text = await restoredBlob.text();
        expect(text).toBe(originalContent);
    });

    it("generates comprehensive searchSnippet and attachmentsStatus in buildResumeHeader", () => {
        const resume: Resume = {
            id: "test-uuid-1",
            schemaVersion: 2,
            version: 1,
            updatedAt: 1000,
            analyzedAt: 1000,
            status: "completed",
            companyName: "Google Cloud",
            jobTitle: "Staff Infrastructure Engineer",
            jobDescription: "Lead distributed Kubernetes cluster architecture",
            resumePath: "local://resume.pdf",
            imagePath: "local://preview.png",
            rawText:
                "Experienced in Docker, Terraform, Go, and high availability distributed systems.",
            feedback: {
                overallScore: 92,
                source: "ai",
                confidence: "high",
                ATS: { score: 95, tips: [] },
                toneAndStyle: { score: 90, tips: [] },
                content: { score: 90, tips: [] },
                structure: { score: 95, tips: [] },
                skills: { score: 90, tips: [] },
                keywords: {
                    matchScore: 88,
                    matching: ["Kubernetes", "Docker", "Terraform", "Go"],
                    missing: ["Istio"],
                },
            },
        };

        const header = buildResumeHeader(resume);
        expect(header.id).toBe("test-uuid-1");
        expect(header.overallScore).toBe(92);
        expect(header.source).toBe("ai");
        expect(header.confidence).toBe("high");
        expect(header.attachmentsStatus).toBe("complete");
        expect(header.searchSnippet).toContain("kubernetes");
        expect(header.searchSnippet).toContain("terraform");
        expect(header.searchSnippet).toContain("staff infrastructure engineer");
        expect(header.searchSnippet).toContain("google cloud");
    });

    it("verifies real blob existence in checkAttachmentsStatus correctly", async () => {
        const pdfPath = "local://resumes/att-check.pdf";
        const imgPath = "local://resumes/att-check.png";

        // When neither blob exists in IndexedDB
        expect(await checkAttachmentsStatus(pdfPath, imgPath)).toBe("missing");
        expect(await checkAttachmentsStatus("", "")).toBe("missing");

        // When only PDF exists
        await saveLocalBlob(pdfPath, new Blob(["pdf"]), "att-check.pdf");
        expect(await checkAttachmentsStatus(pdfPath, imgPath)).toBe("partial");

        // When both PDF and Image exist
        await saveLocalBlob(imgPath, new Blob(["img"]), "att-check.png");
        expect(await checkAttachmentsStatus(pdfPath, imgPath)).toBe("complete");
    });

    it("performs real CRUD operations on IndexedDB blobs and entities", async () => {
        const blobContent = "Real IndexedDB blob payload";
        const blob = new Blob([blobContent], { type: "text/plain" });
        const blobPath = "local://files/test-doc.txt";

        expect(await hasLocalBlob(blobPath)).toBe(false);

        await saveLocalBlob(blobPath, blob, "test-doc.txt");
        expect(await hasLocalBlob(blobPath)).toBe(true);

        const loadedBlob = await getLocalBlob(blobPath);
        expect(loadedBlob).not.toBeNull();
        expect(await loadedBlob?.text()).toBe(blobContent);

        const blobsList = await listLocalBlobs();
        expect(blobsList.some((b) => b.path === blobPath)).toBe(true);

        // Resume CRUD
        const resume: Resume = {
            id: "res-crud-1",
            schemaVersion: 2,
            version: 1,
            resumePath: blobPath,
            imagePath: "local://files/preview.png",
            companyName: "Meta",
            jobTitle: "Production Engineer",
            feedback: {
                overallScore: 85,
                source: "ai",
                ATS: { score: 85, tips: [] },
                toneAndStyle: { score: 80, tips: [] },
                content: { score: 85, tips: [] },
                structure: { score: 90, tips: [] },
                skills: { score: 85, tips: [] },
            },
        };

        expect(await hasResumeEntity("res-crud-1")).toBe(false);
        const saveRes = await saveResumeEntity(resume);
        expect(saveRes.success).toBe(true);
        expect(await hasResumeEntity("res-crud-1")).toBe(true);

        const loadedResume = await getResumeEntity("res-crud-1");
        expect(loadedResume?.companyName).toBe("Meta");
        expect(loadedResume?.jobTitle).toBe("Production Engineer");

        // Delete blob and entity
        await deleteLocalBlob(blobPath);
        expect(await hasLocalBlob(blobPath)).toBe(false);

        await deleteResumeEntity("res-crud-1");
        expect(await hasResumeEntity("res-crud-1")).toBe(false);
    });

    it("performs full round-trip exportAllResumeData and importBackupData with real blobs", async () => {
        const pdfBlob = base64ToBlob(SAMPLE_PDF_BASE64);
        const pngBlob = base64ToBlob(SAMPLE_PNG_BASE64);

        const resumeId = "export-import-test-1";
        const pdfPath = `local://resumes/${resumeId}.pdf`;
        const pngPath = `local://resumes/${resumeId}.png`;

        await saveLocalBlob(pdfPath, pdfBlob, `${resumeId}.pdf`);
        await saveLocalBlob(pngPath, pngBlob, `${resumeId}.png`);

        const resume: Resume = {
            id: resumeId,
            schemaVersion: 2,
            version: 1,
            status: "completed",
            resumePath: pdfPath,
            imagePath: pngPath,
            companyName: "Apple",
            jobTitle: "Swift Engineer",
            rawText: "Swift, SwiftUI, Combine developer",
            feedback: {
                overallScore: 90,
                source: "ai",
                ATS: { score: 90, tips: [] },
                toneAndStyle: { score: 90, tips: [] },
                content: { score: 90, tips: [] },
                structure: { score: 90, tips: [] },
                skills: { score: 90, tips: [] },
            },
        };
        await saveResumeEntity(resume);

        // Export
        const backup = await exportAllResumeData();
        expect(backup.version).toBe(2);
        expect(backup.resumes.length).toBe(1);
        expect(backup.resumes[0].entity.id).toBe(resumeId);
        expect(backup.resumes[0].pdfBase64).toBeDefined();
        expect(backup.resumes[0].imageBase64).toBeDefined();

        // Clear database
        await clearAllResumeEntities();
        await deleteLocalBlob(pdfPath);
        await deleteLocalBlob(pngPath);

        expect(await hasResumeEntity(resumeId)).toBe(false);
        expect(await hasLocalBlob(pdfPath)).toBe(false);

        // Import
        const importRes = await importBackupData(backup);
        expect(importRes.success).toBe(true);
        expect(importRes.total).toBe(1);
        expect(importRes.restored).toBe(1);
        expect(importRes.skipped).toBe(0);
        expect(importRes.errors).toEqual([]);

        // Verify restoration
        expect(await hasResumeEntity(resumeId)).toBe(true);
        expect(await hasLocalBlob(pdfPath)).toBe(true);
        expect(await hasLocalBlob(pngPath)).toBe(true);
        const restoredEntity = await getResumeEntity(resumeId);
        expect(restoredEntity?.companyName).toBe("Apple");
    });

    it("resolves collision by assigning a fresh UUID and new blob paths", async () => {
        const pdfBlob = base64ToBlob(SAMPLE_PDF_BASE64);
        const pngBlob = base64ToBlob(SAMPLE_PNG_BASE64);
        const existingId = "existing-uuid-100";
        const existingPdfPath = `local://resumes/${existingId}.pdf`;
        const existingPngPath = `local://resumes/${existingId}.png`;

        await saveLocalBlob(existingPdfPath, pdfBlob, `${existingId}.pdf`);
        await saveLocalBlob(existingPngPath, pngBlob, `${existingId}.png`);

        const existingResume: Resume = {
            id: existingId,
            schemaVersion: 2,
            version: 1,
            status: "completed",
            resumePath: existingPdfPath,
            imagePath: existingPngPath,
            companyName: "Original Corp",
            jobTitle: "Senior Architect",
            feedback: {
                overallScore: 80,
                source: "heuristic",
                ATS: { score: 80, tips: [] },
                toneAndStyle: { score: 80, tips: [] },
                content: { score: 80, tips: [] },
                structure: { score: 80, tips: [] },
                skills: { score: 80, tips: [] },
            },
        };
        await saveResumeEntity(existingResume);

        // Attempt importing an item that has the same ID
        const collidingBackup = {
            version: 2,
            resumes: [
                {
                    entity: { ...existingResume, companyName: "Imported Duplicate Corp" },
                    pdfBase64: SAMPLE_PDF_BASE64,
                    imageBase64: SAMPLE_PNG_BASE64,
                },
            ],
        };

        const res = await importBackupData(collidingBackup);
        expect(res.success).toBe(true);
        expect(res.restored).toBe(1);

        // Original entity must NOT be modified
        const originalEntity = await getResumeEntity(existingId);
        expect(originalEntity?.companyName).toBe("Original Corp");

        // The imported duplicate was assigned a new ID and saved alongside
        const allBlobs = await listLocalBlobs();
        expect(allBlobs.length).toBe(4); // 2 original + 2 re-mapped
    });

    it("garbage collector deletes unreferenced orphan blobs while keeping active resume blobs", async () => {
        const activePdf = base64ToBlob(SAMPLE_PDF_BASE64);
        const orphanBlob = new Blob(["orphan data"], { type: "text/plain" });
        const staleProcessingPdf = base64ToBlob(SAMPLE_PDF_BASE64);

        const activePath = "local://resumes/active.pdf";
        const orphanPath = "local://resumes/orphan.pdf";
        const staleProcessingPath = "local://resumes/stale.pdf";

        await saveLocalBlob(activePath, activePdf, "active.pdf");
        await saveLocalBlob(orphanPath, orphanBlob, "orphan.pdf");
        await saveLocalBlob(staleProcessingPath, staleProcessingPdf, "stale.pdf");

        const activeResume: Resume = {
            id: "active-resume",
            schemaVersion: 2,
            version: 1,
            resumePath: activePath,
            imagePath: "",
            companyName: "Active Co",
            jobTitle: "Active Role",
            feedback: {
                overallScore: 90,
                source: "ai",
                ATS: { score: 90, tips: [] },
                toneAndStyle: { score: 90, tips: [] },
                content: { score: 90, tips: [] },
                structure: { score: 90, tips: [] },
                skills: { score: 90, tips: [] },
            },
        };
        await saveResumeEntity(activeResume);

        const staleResume: Resume = {
            id: "stale-processing-resume",
            schemaVersion: 2,
            version: 1,
            status: "processing",
            processingStartedAt: Date.now() - 100000,
            heartbeatAt: Date.now() - 100000,
            resumePath: staleProcessingPath,
            imagePath: "",
            companyName: "Stale Co",
            jobTitle: "Role",
            feedback: {
                overallScore: 0,
                source: "heuristic",
                ATS: { score: 0, tips: [] },
                toneAndStyle: { score: 0, tips: [] },
                content: { score: 0, tips: [] },
                structure: { score: 0, tips: [] },
                skills: { score: 0, tips: [] },
            },
        };
        await saveResumeEntity(staleResume);

        expect(await hasLocalBlob(activePath)).toBe(true);
        expect(await hasLocalBlob(orphanPath)).toBe(true);
        expect(await hasResumeEntity("stale-processing-resume")).toBe(true);

        const gcRes = await runStorageGarbageCollector(0);
        expect(gcRes.deletedBlobs).toBe(2); // orphan + stale
        expect(gcRes.deletedOrphanEntities).toBe(1); // stale processing entity

        expect(await hasLocalBlob(activePath)).toBe(true);
        expect(await hasLocalBlob(orphanPath)).toBe(false);
        expect(await hasLocalBlob(staleProcessingPath)).toBe(false);
        expect(await hasResumeEntity("stale-processing-resume")).toBe(false);
    });

    it("garbage collector reconciles index headers with the entity store", async () => {
        // A header whose entity disappeared (crashed delete) is a ghost entry.
        await kvSet(
            "resume:ghost-entity",
            JSON.stringify({ id: "ghost-entity", companyName: "Ghost" }),
        );

        // An entity without a header is invisible in the list (header write failed).
        await saveResumeEntity({
            id: "missing-header",
            schemaVersion: 2,
            version: 3,
            resumePath: "",
            imagePath: "",
            companyName: "Hidden Co",
            jobTitle: "Hidden Role",
            feedback: {
                overallScore: 70,
                source: "heuristic",
                ATS: { score: 70, tips: [] },
                toneAndStyle: { score: 70, tips: [] },
                content: { score: 70, tips: [] },
                structure: { score: 70, tips: [] },
                skills: { score: 70, tips: [] },
            },
        });

        const gcRes = await runStorageGarbageCollector(0);
        expect(gcRes.deletedOrphanHeaders).toBe(1);
        expect(gcRes.repairedHeaders).toBe(1);

        expect(await kvList("resume:*")).toEqual(["resume:missing-header"]);
        expect((await getResumeEntity("missing-header"))?.companyName).toBe("Hidden Co");
    });

    it("validates local paths and magic bytes correctly", () => {
        expect(isValidLocalPath("local://resumes/abc.pdf")).toBe(true);
        expect(isValidLocalPath("local://valid-path_123.png")).toBe(true);
        expect(isValidLocalPath("https://malicious.com/steal")).toBe(false);
        expect(isValidLocalPath("local://../traversal")).toBe(false);

        expect(isValidPdfBase64(SAMPLE_PDF_BASE64)).toBe(true);
        expect(isValidPdfBase64("data:application/pdf;base64,bm90LWEtcGRm")).toBe(false);

        expect(isValidImageBase64(SAMPLE_PNG_BASE64)).toBe(true);
        expect(isValidImageBase64("data:image/png;base64,bm90LWEtcG5n")).toBe(false);

        expect(estimateBase64Bytes(SAMPLE_PDF_BASE64)).toBeGreaterThan(50);
        expect(estimateBase64Bytes(null)).toBe(0);
        expect(estimateBase64Bytes(undefined)).toBe(0);
        expect(estimateBase64Bytes(123)).toBe(0);
    });

    it("handles malformed types inside backup payload gracefully without throwing", async () => {
        const malformedBackup = {
            version: 2,
            resumes: [
                {
                    entity: {
                        id: "valid-id",
                        schemaVersion: 2,
                        version: 1,
                        updatedAt: 1,
                        analyzedAt: 1,
                        status: "completed",
                        resumePath: "local://test.pdf",
                        imagePath: "local://test.png",
                        companyName: "Test Co",
                        jobTitle: "Tester",
                        jobDescription: "Desc",
                    },
                    pdfBase64: 12345, // invalid type: number instead of string
                    imageBase64: false, // invalid type: boolean instead of string
                },
                {
                    entity: "not-an-object", // completely malformed entity
                },
                null,
            ],
        };

        const res = await importBackupData(malformedBackup);
        expect(res.success).toBe(false);
        expect(res.total).toBe(3);
        expect(res.skipped).toBe(3);
        expect(res.errors.length).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(res.warnings)).toBe(true);
    });

    it("rejects backups with excessive item counts or payload sizes exceeding 50 MB", async () => {
        const emptyRes = await importBackupData({});
        expect(emptyRes.success).toBe(false);
        expect(emptyRes.errors.length).toBeGreaterThan(0);

        const oversizedList = Array.from({ length: MAX_BACKUP_RESUMES + 5 }).map((_, i) => ({
            entity: { id: `id-${i}` },
        }));
        const oversizedRes = await importBackupData({ version: 2, resumes: oversizedList });
        expect(oversizedRes.success).toBe(false);
        expect(oversizedRes.errors[0]).toContain("maximum allowed resumes");

        // Test payload exceeding 50 MB total
        const hugePayload = "A".repeat(70 * 1024 * 1024);
        const oversizedBytesBackup = {
            version: 2,
            resumes: [
                {
                    entity: {
                        id: "huge-resume",
                        schemaVersion: 2,
                        version: 1,
                        updatedAt: 1,
                        analyzedAt: 1,
                        status: "completed",
                        resumePath: "local://huge.pdf",
                        imagePath: "local://huge.png",
                        companyName: "Test",
                        jobTitle: "Dev",
                        jobDescription: "Desc",
                    },
                    pdfBase64: `data:application/pdf;base64,${hugePayload}`,
                },
            ],
        };

        const sizeRes = await importBackupData(oversizedBytesBackup);
        expect(sizeRes.success).toBe(false);
        expect(sizeRes.errors.some((e) => e.includes("exceeds"))).toBe(true);
    });

    it("automatically migrates legacy entity on read via getResumeEntity", async () => {
        const legacyId = "legacy-v1-entity";
        const legacyEntity = {
            id: legacyId,
            resumePath: "local://resumes/legacy.pdf",
            imagePath: "local://resumes/legacy.png",
            // Missing schemaVersion and version (v1 shape)
            companyName: "Old Corp",
            jobTitle: "Old Engineer",
            feedback: {
                overallScore: 75,
                source: "ai",
                ATS: { score: 75, tips: [] },
                toneAndStyle: { score: 75, tips: [] },
                content: { score: 75, tips: [] },
                structure: { score: 75, tips: [] },
                skills: { score: 75, tips: [] },
            },
        };

        // Write directly to IndexedDB without standard saveResumeEntity wrapper
        const db = await getDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction("resumes", "readwrite");
            const store = tx.objectStore("resumes");
            store.put(legacyEntity);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        // Read using getResumeEntity
        const retrieved = await getResumeEntity(legacyId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.schemaVersion).toBe(2);
        expect(retrieved?.version).toBe(1);
        expect(retrieved?.companyName).toBe("Old Corp");
    });
});
