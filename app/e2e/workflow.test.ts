import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
    saveResumeEntity,
    getResumeEntity,
    deleteResumeEntity,
    generateResumeFeedback,
    computeConfidence,
    extractProfileSignals,
    exportAllResumeData,
    importBackupData,
    encryptBackupData,
    decryptBackupData,
    isEncryptedBackup,
    InvalidPassphraseError,
    runStorageGarbageCollector,
} from "~/lib/store";
import { buildResumeHeader } from "~/domain/resume";
import { RESUME_SCHEMA_VERSION } from "~/lib/migrations";
import { useI18nStore } from "~/lib/i18n";
import { useThemeStore } from "~/lib/theme";

describe("E2E User Workflow & State Lifecycle", () => {
    beforeEach(() => {
        // Reset in-memory localStorage simulation
        if (typeof localStorage !== "undefined") {
            localStorage.clear();
        }
    });

    it("executes the complete resume lifecycle from analysis to deletion and backup restore", async () => {
        const resumeId = "e2e-resume-uuid-001";
        const jobTitle = "Senior Frontend Architect";
        const companyName = "Acme Corp";
        const jobDescription = "We are seeking a React and TypeScript engineer with performance optimization experience.";
        const resumeText = `
John Doe
Email: john.doe@example.com | Phone: +1 555-0199 | LinkedIn: linkedin.com/in/johndoe
Summary:
Senior Engineer with 8 years of experience building modern web apps.
Experience:
- Architected enterprise React and TypeScript platform, improving load times by 45%.
- Led team of 6 engineers to deliver cloud infrastructure on AWS, reducing costs by $50k.
- Developed automated CI/CD pipelines and micro-frontends with Next.js.
Education:
Bachelor of Science in Computer Science, University of Technology.
Skills:
JavaScript, TypeScript, React, Next.js, Node.js, AWS, Docker, CI/CD, Git.
`;

        // 1. Save initial processing state
        const initialEntity = {
            id: resumeId,
            schemaVersion: RESUME_SCHEMA_VERSION,
            jobTitle,
            companyName,
            jobDescription,
            resumePath: `local://resumes/${resumeId}/resume.pdf`,
            imagePath: `local://resumes/${resumeId}/preview.png`,
            rawText: resumeText,
            status: "processing" as const,
            processingStartedAt: Date.now(),
            heartbeatAt: Date.now(),
            updatedAt: Date.now(),
            feedback: {} as any,
        };

        const initRes = await saveResumeEntity(initialEntity);
        expect(initRes.success).toBe(true);
        expect(initRes.entity.status).toBe("processing");
        expect(initRes.entity.version).toBe(1);

        // 2. Perform Heuristic Analysis
        const feedback = generateResumeFeedback(
            { rawText: resumeText, jobTitle, jobDescription },
            "en"
        );

        expect(feedback.overallScore).toBeGreaterThanOrEqual(60);
        expect(feedback.ATS.score).toBeGreaterThanOrEqual(55);
        expect(feedback.keywords?.matching.length).toBeGreaterThanOrEqual(2);

        const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
        const confidence = computeConfidence({
            wordCount,
            targetKeywordCount: (feedback.keywords?.matching.length || 0) + (feedback.keywords?.missing.length || 0),
            hasJobDescription: true,
            metricCount: 2,
            hasResumeText: true,
        });
        expect(confidence).toBe("high");

        // 3. Complete and persist entity
        const completedEntity = {
            ...initialEntity,
            status: "completed" as const,
            analyzedAt: Date.now(),
            updatedAt: Date.now(),
            feedback: {
                ...feedback,
                source: "heuristic" as const,
                confidence,
            },
        };

        const saveRes = await saveResumeEntity(completedEntity);
        expect(saveRes.success).toBe(true);
        expect(saveRes.entity.version).toBe(2);
        expect(saveRes.entity.status).toBe("completed");

        // 4. Build index header
        const header = buildResumeHeader(saveRes.entity);
        expect(header.id).toBe(resumeId);
        expect(header.overallScore).toBe(feedback.overallScore);
        expect(header.jobTitle).toBe(jobTitle);

        // 5. Verify retrieval from IndexedDB
        const retrieved = await getResumeEntity(resumeId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(resumeId);
        expect(retrieved?.version).toBe(2);

        // 6. Verify profile signals for Cover Letter
        const signals = extractProfileSignals(resumeText);
        expect(signals.yearsExperience).toBe(8);
        expect(signals.quantifiedAchievements).toBeGreaterThanOrEqual(2);

        // 7. Export full data backup
        const exportedData = await exportAllResumeData();
        expect(exportedData.resumes.length).toBeGreaterThanOrEqual(1);
        expect(exportedData.version).toBe(2);

        // 8. Encrypt and decrypt backup with AES-GCM
        const passphrase = "correct-secure-password-123";
        const encrypted = await encryptBackupData(exportedData, passphrase);
        expect(isEncryptedBackup(encrypted)).toBe(true);

        // Decrypt with wrong password fails
        await expect(decryptBackupData(encrypted, "wrong-passphrase")).rejects.toThrow(InvalidPassphraseError);

        // Decrypt with correct password succeeds
        const decrypted = (await decryptBackupData(encrypted, passphrase)) as any;
        expect(decrypted.version).toBe(2);
        expect(decrypted.resumes[0].entity.id).toBe(resumeId);

        // 9. Re-import backup
        const importRes = await importBackupData(decrypted);
        expect(importRes.success).toBe(true);
        expect(importRes.restored).toBeGreaterThanOrEqual(1);

        // 10. Delete entity
        const deleted = await deleteResumeEntity(resumeId);
        expect(deleted).toBe(true);

        const postDelete = await getResumeEntity(resumeId);
        expect(postDelete).toBeNull();
    });

    it("verifies garbage collector cleans up stale processing records", async () => {
        const staleId = "stale-processing-001";
        const staleTime = Date.now() - 30 * 60 * 1000; // 30 mins ago

        await saveResumeEntity({
            id: staleId,
            schemaVersion: RESUME_SCHEMA_VERSION,
            jobTitle: "Ghost",
            companyName: "Ghost Corp",
            jobDescription: "",
            resumePath: "",
            imagePath: "",
            rawText: "",
            status: "processing",
            processingStartedAt: staleTime,
            heartbeatAt: staleTime,
            updatedAt: staleTime,
            feedback: {} as any,
        });

        const beforeGC = await getResumeEntity(staleId);
        expect(beforeGC).not.toBeNull();

        const gcResult = await runStorageGarbageCollector(25 * 60 * 1000);
        expect(gcResult.deletedOrphanEntities).toBeGreaterThanOrEqual(1);

        const afterGC = await getResumeEntity(staleId);
        expect(afterGC).toBeNull();
    });

    it("toggles application language and theme state correctly", () => {
        const i18n = useI18nStore.getState();
        expect(["es", "en"]).toContain(i18n.language);

        i18n.setLanguage("en");
        expect(useI18nStore.getState().language).toBe("en");
        expect(useI18nStore.getState().t.navbar.appName).toBe("CVision AI");

        i18n.setLanguage("es");
        expect(useI18nStore.getState().language).toBe("es");
        expect(useI18nStore.getState().t.navbar.appName).toBe("CVision AI");

        const theme = useThemeStore.getState();
        theme.setTheme("dark");
        expect(useThemeStore.getState().theme).toBe("dark");

        theme.setTheme("light");
        expect(useThemeStore.getState().theme).toBe("light");
    });
});
