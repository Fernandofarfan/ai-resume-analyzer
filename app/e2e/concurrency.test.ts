import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { saveResumeEntity, getResumeEntity, runStorageGarbageCollector } from "~/lib/store";
import { saveLocalBlob, getLocalBlob, deleteLocalBlob } from "~/lib/storage/indexeddb";
import { isStaleWrite, withTabLock, getTabId } from "~/lib/tabsync";
import { EMPTY_FEEDBACK, RESUME_SCHEMA_VERSION } from "~/lib/migrations";

describe("Concurrency, Mutex Locks & State Resilience", () => {
    beforeEach(() => {
        if (typeof localStorage !== "undefined") {
            localStorage.clear();
        }
    });

    it("verifies unique tab ID generation and format", () => {
        const tabId1 = getTabId();
        const tabId2 = getTabId();
        expect(tabId1).toBeDefined();
        expect(tabId1).toBe(tabId2); // Same runtime execution context retains persistent tabId
        expect(tabId1.length).toBeGreaterThan(4);
    });

    it("serializes concurrent tasks using withTabLock", async () => {
        const completed: number[] = [];
        let active = 0;
        let maxActive = 0;
        const track = (id: number, delayMs: number, result: string) =>
            withTabLock("test-lock", async () => {
                active += 1;
                maxActive = Math.max(maxActive, active);
                await new Promise((r) => setTimeout(r, delayMs));
                completed.push(id);
                active -= 1;
                return result;
            });

        const [r1, r2] = await Promise.all([track(1, 20, "res1"), track(2, 0, "res2")]);
        expect(r1).toBe("res1");
        expect(r2).toBe("res2");
        // The contract is mutual exclusion, not which caller wins the race.
        expect(maxActive).toBe(1);
        expect([...completed].sort((a, b) => a - b)).toEqual([1, 2]);
    });

    it("detects and prevents stale concurrent writes when version or timestamp is outdated", () => {
        const current = { version: 5, updatedAt: 10000 };

        // 1. Older version
        expect(isStaleWrite({ version: 4, updatedAt: 12000 }, current)).toBe(true);

        // 2. Same version, older timestamp
        expect(isStaleWrite({ version: 5, updatedAt: 9000 }, current)).toBe(true);

        // 3. Newer version
        expect(isStaleWrite({ version: 6, updatedAt: 10000 }, current)).toBe(false);

        // 4. Same version, newer timestamp
        expect(isStaleWrite({ version: 5, updatedAt: 11000 }, current)).toBe(false);
    });

    it("prevents stale write collision when saving to IndexedDB with expectedVersion", async () => {
        const resumeId = "concurrent-resume-001";
        const initial = {
            id: resumeId,
            schemaVersion: RESUME_SCHEMA_VERSION,
            jobTitle: "Software Engineer",
            companyName: "Corp",
            jobDescription: "",
            resumePath: `local://resumes/${resumeId}/resume.pdf`,
            imagePath: `local://resumes/${resumeId}/preview.png`,
            rawText: "Sample resume text",
            status: "completed" as const,
            updatedAt: Date.now(),
            feedback: { ...EMPTY_FEEDBACK, overallScore: 80 },
        };

        const res1 = await saveResumeEntity(initial);
        expect(res1.success).toBe(true);
        expect(res1.entity.version).toBe(1);

        // Tab A attempts to save with expectedVersion = 1 -> succeeds, version becomes 2
        const res2 = await saveResumeEntity(
            {
                ...res1.entity,
                jobTitle: "Senior Software Engineer",
                updatedAt: Date.now() + 10,
            },
            1,
        );
        expect(res2.success).toBe(true);
        expect(res2.entity.version).toBe(2);

        // Tab B attempts to save with stale expectedVersion = 1 -> rejected with version_mismatch
        const resStale = await saveResumeEntity(
            {
                ...res1.entity,
                jobTitle: "Staff Software Engineer",
                updatedAt: Date.now() + 20,
            },
            1,
        );
        expect(resStale.success).toBe(false);
        expect(resStale.reason).toBe("version_mismatch");
        expect(resStale.entity.version).toBe(2);
    });

    it("cleans up abandoned processing entities while preserving active processing entities", async () => {
        const staleId = "abandoned-processing-task";
        const activeId = "active-processing-task";
        const now = Date.now();
        const staleTimestamp = now - 45 * 60 * 1000; // 45 min ago
        const freshTimestamp = now - 2 * 60 * 1000; // 2 min ago (heartbeat active)

        await saveResumeEntity({
            id: staleId,
            schemaVersion: RESUME_SCHEMA_VERSION,
            jobTitle: "Abandoned",
            companyName: "",
            jobDescription: "",
            resumePath: `local://resumes/${staleId}/resume.pdf`,
            imagePath: "",
            rawText: "",
            status: "processing",
            processingStartedAt: staleTimestamp,
            heartbeatAt: staleTimestamp,
            updatedAt: staleTimestamp,
            feedback: EMPTY_FEEDBACK,
        });

        await saveResumeEntity({
            id: activeId,
            schemaVersion: RESUME_SCHEMA_VERSION,
            jobTitle: "Active",
            companyName: "",
            jobDescription: "",
            resumePath: `local://resumes/${activeId}/resume.pdf`,
            imagePath: "",
            rawText: "",
            status: "processing",
            processingStartedAt: staleTimestamp,
            heartbeatAt: freshTimestamp,
            updatedAt: freshTimestamp,
            feedback: EMPTY_FEEDBACK,
        });

        const gcResult = await runStorageGarbageCollector(30 * 60 * 1000);
        expect(gcResult.deletedOrphanEntities).toBeGreaterThanOrEqual(1);

        const staleEntity = await getResumeEntity(staleId);
        expect(staleEntity).toBeNull();

        const activeEntity = await getResumeEntity(activeId);
        expect(activeEntity).not.toBeNull();
        expect(activeEntity?.id).toBe(activeId);
    });

    it("verifies atomic blob storage creation and deletion", async () => {
        const testPath = "local://resumes/atomic-test/sample.pdf";
        const blob = new Blob(["PDF dummy binary content"], { type: "application/pdf" });

        const item = await saveLocalBlob(testPath, blob, "sample.pdf");
        expect(item.path).toBe(testPath);
        expect(item.size).toBe(blob.size);

        const retrieved = await getLocalBlob(testPath);
        expect(retrieved).toBeDefined();
        expect(retrieved?.size).toBe(blob.size);

        await deleteLocalBlob(testPath);
        const postDelete = await getLocalBlob(testPath);
        expect(postDelete).toBeUndefined();
    });
});
