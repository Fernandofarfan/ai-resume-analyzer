import { describe, it, expect } from "vitest";
import {
    clampScore,
    validateFeedback,
    normalizeFeedback,
    parseFeedbackText,
    validateAuthHeader,
} from "../../../shared/schema.mjs";

describe("shared pure schema validation and normalization", () => {
    it("clamps scores to 0-100 integers", () => {
        expect(clampScore(-10)).toBe(0);
        expect(clampScore(150)).toBe(100);
        expect(clampScore(78.6)).toBe(79);
        expect(clampScore(NaN)).toBe(0);
        expect(clampScore("invalid")).toBe(0);
    });

    it("validates and normalizes complete feedback payload", () => {
        const payload = {
            overallScore: 85,
            ATS: {
                score: 90,
                tips: [{ type: "good", tip: "Strong action verbs" }],
            },
            toneAndStyle: { score: 80, tips: [] },
            content: { score: 85, tips: [] },
            structure: { score: 90, tips: [] },
            skills: { score: 85, tips: [] },
            keywords: {
                matchScore: 75,
                matching: ["React", "TypeScript"],
                missing: ["GraphQL"],
            },
            bulletRewrites: [
                {
                    originalTip: "Did coding",
                    suggestedRewrite: "Architected modern React apps",
                    reasoning: "Action verb",
                },
            ],
            injectedBadField: "malicious code",
        };

        const result = validateFeedback(payload);
        expect(result).not.toBeNull();
        expect(result?.overallScore).toBe(85);
        expect(result?.ATS.score).toBe(90);
        expect(result?.keywords?.matching).toEqual(["React", "TypeScript"]);
        expect(result?.keywords?.missing).toEqual(["GraphQL"]);
        expect((result as any)?.injectedBadField).toBeUndefined();
    });

    it("parses JSON wrapped in markdown fences", () => {
        const fenced = "```json\n" + JSON.stringify({
            overallScore: 80,
            ATS: { score: 80, tips: [] },
            toneAndStyle: { score: 80, tips: [] },
            content: { score: 80, tips: [] },
            structure: { score: 80, tips: [] },
            skills: { score: 80, tips: [] },
        }) + "\n```";

        const parsed = parseFeedbackText(fenced);
        expect(parsed).not.toBeNull();
        expect(parsed?.overallScore).toBe(80);
    });

    it("validates Bearer tokens and x-api-key headers", () => {
        expect(validateAuthHeader({ headers: {} }, "")).toBe(true);
        expect(
            validateAuthHeader(
                { headers: { authorization: "Bearer secret-token-123" } },
                "secret-token-123"
            )
        ).toBe(true);
        expect(
            validateAuthHeader(
                { headers: { "x-api-key": "secret-token-123" } },
                "secret-token-123"
            )
        ).toBe(true);
        expect(
            validateAuthHeader(
                { headers: { authorization: "Bearer wrong-token" } },
                "secret-token-123"
            )
        ).toBe(false);
    });
});
