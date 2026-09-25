import { describe, it, expect } from "vitest";
import { migrateResume, RESUME_SCHEMA_VERSION, isUpToDate } from "./migrations";

describe("migrateResume", () => {
    it("returns null for invalid records", () => {
        expect(migrateResume(null)).toBeNull();
        expect(migrateResume("x")).toBeNull();
        expect(migrateResume({ id: "1" })).toBeNull();
    });

    it("normalizes a legacy record missing source/confidence", () => {
        const legacy = {
            id: "abc",
            resumePath: "local://1.pdf",
            imagePath: "local://1.png",
            rawText: "software engineer",
            feedback: {
                overallScore: 70,
                ATS: { score: 65, tips: [] },
                toneAndStyle: { score: 60, tips: [] },
                content: { score: 62, tips: [] },
                structure: { score: 58, tips: [] },
                skills: { score: 66, tips: [] },
            },
        };
        const migrated = migrateResume(legacy);
        expect(migrated?.id).toBe("abc");
        expect(migrated?.schemaVersion).toBe(RESUME_SCHEMA_VERSION);
        expect(migrated?.feedback.overallScore).toBe(70);
    });

    it("replaces invalid feedback with a heuristic placeholder", () => {
        const legacy = { id: "a", resumePath: "r", imagePath: "i", feedback: "not-an-object" };
        const migrated = migrateResume(legacy);
        expect(migrated?.feedback.source).toBe("heuristic");
        expect(migrated?.feedback.overallScore).toBe(0);
    });

    it("marks legacy feedback without a source as heuristic", () => {
        const legacy = {
            id: "a",
            resumePath: "r",
            imagePath: "i",
            feedback: {
                overallScore: 70,
                ATS: { score: 1, tips: [] },
                toneAndStyle: { score: 1, tips: [] },
                content: { score: 1, tips: [] },
                structure: { score: 1, tips: [] },
                skills: { score: 1, tips: [] },
            },
        };
        const migrated = migrateResume(legacy);
        expect(migrated?.feedback.source).toBe("heuristic");
    });

    it("preserves the processing status", () => {
        const legacy = {
            id: "a",
            resumePath: "r",
            imagePath: "i",
            status: "processing",
            feedback: {
                overallScore: 70,
                ATS: { score: 1, tips: [] },
                toneAndStyle: { score: 1, tips: [] },
                content: { score: 1, tips: [] },
                structure: { score: 1, tips: [] },
                skills: { score: 1, tips: [] },
            },
        };
        expect(migrateResume(legacy)?.status).toBe("processing");
    });
});

describe("isUpToDate", () => {
    it("detects whether a raw record already has the current schema version", () => {
        expect(isUpToDate({ schemaVersion: RESUME_SCHEMA_VERSION })).toBe(true);
        expect(isUpToDate({})).toBe(false);
        expect(isUpToDate(null)).toBe(false);
        expect(isUpToDate("x")).toBe(false);
    });
});
