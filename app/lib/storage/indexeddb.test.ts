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
import { __setForcedListingFailure } from "./idb";
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

    it("reports whether deleteLocalBlob actually removed a row", async () => {
        const blobPath = "local://files/delete-report.txt";

        // Missing key: no row existed, so the call must report false.
        expect(await deleteLocalBlob(blobPath)).toBe(false);

        await saveLocalBlob(blobPath, new Blob(["payload"]), "delete-report.txt");
        expect(await deleteLocalBlob(blobPath)).toBe(true);
        expect(await hasLocalBlob(blobPath)).toBe(false);
    });

    it("keeps live blobs when the resume listing fails", async () => {
        const pdfPath = "local://resumes/gc-live.pdf";
        await saveLocalBlob(pdfPath, new Blob(["pdf"]), "gc-live.pdf");

        // Force the resume listing to fail: previously the GC degraded that into
        // "no resumes exist" and deleted every live blob.
        __setForcedListingFailure(true);
        try {
            const result = await runStorageGarbageCollector(0);
            // The GC must not delete live data just because the listing failed.
            expect(await hasLocalBlob(pdfPath)).toBe(true);
            expect(result.deletedBlobs).toBe(0);
        } finally {
            __setForcedListingFailure(false);
        }
    });

    it("restores metadata-only resumes that have an empty resumePath", async () => {
        const res = await importBackupData({
            version: 2,
            resumes: [
                {
                    entity: {
                        id: "metadata-only-1",
                        schemaVersion: 2,
                        version: 1,
                        updatedAt: 1,
                        analyzedAt: 1,
                        status: "completed",
                        resumePath: "",
                        imagePath: "",
                        companyName: "No Attachment Co",
                        jobTitle: "Planner",
                        jobDescription: "Desc",
                    },
                },
            ],
        });

        expect(res.restored).toBe(1);
        expect(res.skipped).toBe(0);
        expect(await hasResumeEntity("metadata-only-1")).toBe(true);
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
        // Cover BOTH prune branches: one stale resume with a PDF, one with only an
        // image, both past the grace period.
        const staleProcessingPdf = base64ToBlob(SAMPLE_PDF_BASE64);
        const staleImagePng = base64ToBlob(SAMPLE_PNG_BASE64);

        const activePath = "local://resumes/active.pdf";
        const orphanPath = "local://resumes/orphan.pdf";
        const staleProcessingPath = "local://resumes/stale.pdf";
        const staleImagePath = "local://resumes/stale-image.png";

        await saveLocalBlob(activePath, activePdf, "active.pdf");
        await saveLocalBlob(orphanPath, orphanBlob, "orphan.pdf");
        await saveLocalBlob(staleProcessingPath, staleProcessingPdf, "stale.pdf");
        await saveLocalBlob(staleImagePath, staleImagePng, "stale-image.png");

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
            imagePath: staleImagePath,
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
        // Cover the image-branch of the orphan pass too: a complete active resume
        // whose image is referenced must keep both blobs.
        await saveLocalBlob(
            "local://resumes/active.png",
            base64ToBlob(SAMPLE_PNG_BASE64),
            "active.png",
        );
        await saveResumeEntity({
            ...activeResume,
            id: "active-with-image",
            imagePath: "local://resumes/active.png",
        });

        await saveResumeEntity(staleResume);

        expect(await hasLocalBlob(activePath)).toBe(true);
        expect(await hasLocalBlob(orphanPath)).toBe(true);
        expect(await hasResumeEntity("stale-processing-resume")).toBe(true);

        const gcRes = await runStorageGarbageCollector(0);
        expect(gcRes.deletedBlobs).toBe(3); // orphan + stale pdf + stale image
        expect(gcRes.deletedOrphanEntities).toBe(1); // stale processing entity

        expect(await hasLocalBlob(activePath)).toBe(true);
        expect(await hasLocalBlob("local://resumes/active.png")).toBe(true);
        expect(await hasLocalBlob(orphanPath)).toBe(false);
        expect(await hasLocalBlob(staleProcessingPath)).toBe(false);
        expect(await hasLocalBlob(staleImagePath)).toBe(false);
        expect(await hasResumeEntity("stale-processing-resume")).toBe(false);
    });
    it("garbage collector skips in-flight processing resumes while pruning abandoned ones", async () => {
        const liveProcessingPath = "local://resumes/live-processing.pdf";
        await saveLocalBlob(liveProcessingPath, base64ToBlob(SAMPLE_PDF_BASE64), "live.pdf");

        const liveProcessing: Resume = {
            id: "live-processing-resume",
            schemaVersion: 2,
            version: 1,
            status: "processing",
            processingStartedAt: Date.now(),
            heartbeatAt: Date.now(),
            resumePath: liveProcessingPath,
            imagePath: "",
            companyName: "Live Co",
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
        await saveResumeEntity(liveProcessing);

        const res = await runStorageGarbageCollector(30 * 60 * 1000);
        expect(res.deletedOrphanEntities).toBe(0);
        expect(res.deletedBlobs).toBe(0);
        expect(await hasResumeEntity("live-processing-resume")).toBe(true);
        expect(await hasLocalBlob(liveProcessingPath)).toBe(true);
    });

    it("garbage collector reconciles index headers with the entity store", async () => {
        // A header whose entity disappeared (crashed delete) is a ghost entry.
        await kvSet(
            "resume:ghost-entity",
            JSON.stringify({ id: "ghost-entity", companyName: "Ghost" }),
        );

        // An example of a live, concluded entity that has attachments: the GC must
        // leave its blobs alone while reconciling headers.
        await saveResumeEntity({
            id: "header-live",
            schemaVersion: 2,
            version: 1,
            resumePath: "local://resumes/header-live.pdf",
            imagePath: "",
            companyName: "Live Co",
            jobTitle: "Live Role",
            feedback: {
                overallScore: 80,
                source: "heuristic",
                ATS: { score: 80, tips: [] },
                toneAndStyle: { score: 80, tips: [] },
                content: { score: 80, tips: [] },
                structure: { score: 80, tips: [] },
                skills: { score: 80, tips: [] },
            },
        });

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
        expect(gcRes.repairedHeaders).toBe(2);

        expect(await kvList("resume:*")).toEqual(["resume:header-live", "resume:missing-header"]);
        expect((await getResumeEntity("missing-header"))?.companyName).toBe("Hidden Co");
    });

    it("garbage collector keeps a header when its entity still exists", async () => {
        const entity: Resume = {
            id: "survivor",
            schemaVersion: 2,
            version: 1,
            resumePath: "",
            imagePath: "",
            companyName: "Survivor Co",
            jobTitle: "Role",
            feedback: {
                overallScore: 60,
                source: "heuristic",
                ATS: { score: 60, tips: [] },
                toneAndStyle: { score: 60, tips: [] },
                content: { score: 60, tips: [] },
                structure: { score: 60, tips: [] },
                skills: { score: 60, tips: [] },
            },
        };
        await saveResumeEntity(entity);
        await kvSet("resume:survivor", JSON.stringify(buildResumeHeader(entity)));

        const gcRes = await runStorageGarbageCollector(0);
        expect(gcRes.deletedOrphanHeaders).toBe(0);
        expect(await kvList("resume:*")).toContain("resume:survivor");
    });

    it("garbage collector re-checks the entity before pruning a stale processing resume", async () => {
        const path = "local://resumes/rechecked.pdf";
        await saveLocalBlob(path, base64ToBlob(SAMPLE_PDF_BASE64), "rechecked.pdf");

        const stale: Resume = {
            id: "recheck-processing",
            schemaVersion: 2,
            version: 1,
            status: "processing",
            processingStartedAt: Date.now() - 100000,
            heartbeatAt: Date.now() - 100000,
            resumePath: path,
            imagePath: "",
            companyName: "Recheck Co",
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
        await saveResumeEntity(stale);

        // The entity is re-read under the lock; if it is no longer processing (or
        // has a fresh heartbeat) pruning must be skipped. Here the entity vanished
        // between the listing and the pruning step, which must not throw.
        await deleteResumeEntity(stale.id);
        const gcRes = await runStorageGarbageCollector(0);

        // The blob is only removed through the orphan pass, never the prune pass.
        expect(gcRes.deletedOrphanEntities).toBe(0);
        expect(await hasLocalBlob(path)).toBe(false);
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

        // Read using getResumeEntity: it migrates and persists the entity, and
        // returns the stored entity so callers get the version to guard with.
        const retrieved = await getResumeEntity(legacyId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.schemaVersion).toBe(2);
        expect(retrieved?.companyName).toBe("Old Corp");
        expect(typeof retrieved?.version).toBe("number");

        // The migrated entity is persisted, so a second read must not re-migrate
        // and must not bump the version again.
        const versionAfterFirstRead = retrieved?.version;
        const reread = await getResumeEntity(legacyId);
        expect(reread?.schemaVersion).toBe(2);
        expect(reread?.version).toBe(versionAfterFirstRead);
    });
});
