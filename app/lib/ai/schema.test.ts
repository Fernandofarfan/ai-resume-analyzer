import { describe, it, expect } from "vitest";
import { validateFeedback, parseFeedbackText } from "./schema";

const validPayload = {
    overallScore: 78,
    ATS: { score: 80, tips: [{ type: "good", tip: "ok" }] },
    toneAndStyle: { score: 70, tips: [{ type: "improve", tip: "t", explanation: "e" }] },
    content: { score: 72, tips: [] },
    structure: { score: 60, tips: [] },
    skills: { score: 65, tips: [] },
};

describe("validateFeedback", () => {
    it("accepts a valid payload", () => {
        const fb = validateFeedback(validPayload);
        expect(fb?.overallScore).toBe(78);
    });

    it("rejects non-objects", () => {
        expect(validateFeedback("nope")).toBeNull();
        expect(validateFeedback(null)).toBeNull();
        expect(validateFeedback([1, 2, 3])).toBeNull();
    });

    it("rejects a payload with missing overallScore", () => {
        expect(validateFeedback({ ATS: { score: 1 } })).toBeNull();
    });

    it("rejects a payload missing required categories", () => {
        expect(validateFeedback({ overallScore: 80 })).toBeNull();
        expect(validateFeedback({ overallScore: 80, ATS: { score: 1 } })).toBeNull();
    });

    it("rejects a category with a missing or non-numeric score", () => {
        expect(validateFeedback({ ...validPayload, toneAndStyle: { tips: [] } })).toBeNull();
        expect(
            validateFeedback({ ...validPayload, content: { score: "high", tips: [] } }),
        ).toBeNull();
    });

    it("clamps scores to the 0..100 range", () => {
        const fb = validateFeedback({
            ...validPayload,
            overallScore: 250,
            ATS: { score: -5, tips: [] },
        });
        expect(fb?.overallScore).toBe(100);
        expect(fb?.ATS.score).toBe(0);
    });
});

describe("parseFeedbackText", () => {
    it("parses plain JSON", () => {
        const fb = parseFeedbackText(JSON.stringify(validPayload));
        expect(fb?.overallScore).toBe(78);
    });

    it("strips markdown code fences", () => {
        const fb = parseFeedbackText("```json\n" + JSON.stringify(validPayload) + "\n```");
        expect(fb?.overallScore).toBe(78);
    });

    it("returns null for invalid JSON", () => {
        expect(parseFeedbackText("this is not json")).toBeNull();
    });

    it("returns null for empty input", () => {
        expect(parseFeedbackText("")).toBeNull();
    });
});
