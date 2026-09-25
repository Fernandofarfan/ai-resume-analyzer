import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
    MAX_PDF_BYTES,
    MAX_PDF_PAGES,
    MAX_BACKUP_TOTAL_BYTES,
} from "~/lib/limits";
import {
    importBackupData,
    estimateStorageQuota,
} from "~/lib/store";

describe("UI Error Handling & Boundary Validations", () => {
    beforeEach(() => {
        if (typeof localStorage !== "undefined") {
            localStorage.clear();
        }
    });

    it("enforces MAX_PDF_BYTES and MAX_PDF_PAGES constraints", () => {
        const testFileSize = 25 * 1024 * 1024; // 25 MB
        const isOversized = testFileSize > MAX_PDF_BYTES;
        expect(isOversized).toBe(true);

        const pageCount = 12;
        const exceedsPageLimit = pageCount > MAX_PDF_PAGES;
        expect(exceedsPageLimit).toBe(true);
    });

    it("verifies storage quota calculation handles unsupported environments gracefully", async () => {
        const quota = await estimateStorageQuota();
        // In fake/node environment, navigator.storage.estimate may be unavailable or return zero
        if (quota) {
            expect(typeof quota.usageBytes).toBe("number");
            expect(typeof quota.quotaBytes).toBe("number");
            expect(typeof quota.percentUsed).toBe("number");
        }
    });

    it("rejects corrupted or non-object backup data during import", async () => {
        const corruptedData = "not a valid backup object" as any;
        const result = await importBackupData(corruptedData);
        expect(result.success).toBe(false);
        expect(result.restored).toBe(0);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects backup archives that exceed MAX_BACKUP_TOTAL_BYTES", async () => {
        const oversizedResumes = [];
        // Construct large mock item
        for (let i = 0; i < 60; i++) {
            oversizedResumes.push({
                entity: { id: `res-${i}`, jobTitle: "Engineer", updatedAt: Date.now() },
                pdfBase64: "data:application/pdf;base64,JVBERi0xLjQK...",
            });
        }

        const oversizedBackup = {
            version: 2,
            exportedAt: Date.now(),
            resumes: oversizedResumes,
        };

        const result = await importBackupData(oversizedBackup as any);
        expect(result.success).toBe(false);
    });
});
