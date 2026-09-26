import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import {
    CircuitBreaker,
    parseAndValidateFeedback,
    validateAuthHeader,
    validatePrompt,
    MAX_PROMPT_CHARS,
} from "./lib.mjs";
import { callGemini, validateModelName, isLocalEndpoint } from "./index.mjs";

describe("End-to-End Remote Endpoint Pipeline & Edge Cases", () => {
    let mockGeminiServer;
    let geminiPort;
    let geminiUrl;

    beforeAll(async () => {
        mockGeminiServer = createServer((req, res) => {
            let body = "";
            req.on("data", (chunk) => {
                body += chunk;
            });
            req.on("end", () => {
                if (req.headers["x-goog-api-key"] !== "valid-api-key") {
                    res.writeHead(401, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Invalid API key" }));
                }

                const parsed = JSON.parse(body || "{}");
                const prompt = parsed.contents?.[0]?.parts?.[0]?.text || "";

                if (prompt.includes("TRIGGER_500")) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ error: "Upstream AI failure" }));
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        candidates: [
                            {
                                content: {
                                    parts: [
                                        {
                                            text: JSON.stringify({
                                                overallScore: 89,
                                                ATS: {
                                                    score: 85,
                                                    tips: [
                                                        {
                                                            type: "good",
                                                            tip: "Strong keywords",
                                                            explanation: "Well targeted",
                                                        },
                                                    ],
                                                },
                                                toneAndStyle: { score: 90, tips: [] },
                                                content: { score: 88, tips: [] },
                                                structure: { score: 92, tips: [] },
                                                skills: { score: 90, tips: [] },
                                                summary: "Excellent technical resume.",
                                            }),
                                        },
                                    ],
                                },
                            },
                        ],
                    }),
                );
            });
        });

        await new Promise((resolve) => mockGeminiServer.listen(0, "127.0.0.1", resolve));
        geminiPort = mockGeminiServer.address().port;
        geminiUrl = `http://127.0.0.1:${geminiPort}/v1beta/models/gemini-1.5-flash:generateContent`;
    });

    afterAll(async () => {
        if (mockGeminiServer) {
            await new Promise((resolve) => mockGeminiServer.close(resolve));
        }
    });

    it("verifies end-to-end provider execution, prompt wrapping, and feedback normalization", async () => {
        const candidateResume =
            "Senior Full Stack Engineer with 7 years experience in React and Node.js";
        const rawResponse = await callGemini(candidateResume, 5000, undefined, {
            endpoint: geminiUrl,
            apiKey: "valid-api-key",
        });

        expect(rawResponse).toBeDefined();
        const feedback = parseAndValidateFeedback(rawResponse);
        expect(feedback).not.toBeNull();
        expect(feedback?.overallScore).toBe(89);
        expect(feedback?.ATS?.score).toBe(85);
        expect(feedback?.ATS?.tips?.[0]?.type).toBe("good");
        expect(feedback?.skills?.score).toBe(90);
    });

    it("validates that prompt validation correctly rejects payloads exceeding MAX_PROMPT_CHARS", () => {
        const validPayload = JSON.stringify({ message: "Hello world", consent: true });
        const validPrompt = validatePrompt(validPayload);
        expect(validPrompt.error).toBeUndefined();
        expect(validPrompt.message).toBe("Hello world");
        expect(validPrompt.consent).toBe(true);

        const oversizedMessage = "A".repeat(MAX_PROMPT_CHARS + 10);
        const invalidPayload = JSON.stringify({ message: oversizedMessage, consent: true });
        const invalidPrompt = validatePrompt(invalidPayload);
        expect(invalidPrompt.error).toBe("Prompt too large");
    });

    it("validates that validateAuthHeader enforces bearer token and constant-time comparison", () => {
        const requiredSecret = "my-secret-production-token-12345";

        // Missing header -> false
        expect(validateAuthHeader({ headers: {} }, requiredSecret)).toBe(false);

        // Invalid scheme -> false
        expect(
            validateAuthHeader({ headers: { authorization: "Basic abc" } }, requiredSecret),
        ).toBe(false);

        // Wrong token -> false
        expect(
            validateAuthHeader(
                { headers: { authorization: "Bearer wrong-token" } },
                requiredSecret,
            ),
        ).toBe(false);

        // Matching token -> true
        expect(
            validateAuthHeader(
                { headers: { authorization: `Bearer ${requiredSecret}` } },
                requiredSecret,
            ),
        ).toBe(true);

        // Matching x-api-key -> true
        expect(
            validateAuthHeader({ headers: { "x-api-key": requiredSecret } }, requiredSecret),
        ).toBe(true);
    });

    it("verifies circuit breaker fail-fast when upstream provider encounters 500 errors", async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 2000 });

        const failingCall = () =>
            callGemini("TRIGGER_500", 2000, undefined, {
                endpoint: geminiUrl,
                apiKey: "valid-api-key",
            });

        // 1st failure
        await expect(cb.execute(failingCall)).rejects.toThrow("Gemini API error: 500");
        expect(cb.getState()).toBe("CLOSED");

        // 2nd failure -> Trips to OPEN
        await expect(cb.execute(failingCall)).rejects.toThrow("Gemini API error: 500");
        expect(cb.getState()).toBe("OPEN");

        // 3rd call immediately fails fast with 503 without hitting network
        await expect(cb.execute(failingCall)).rejects.toMatchObject({
            status: 503,
            isCircuitOpen: true,
        });
    });

    it("verifies validateModelName and isLocalEndpoint security utilities", () => {
        expect(() => validateModelName("GEMINI_MODEL", "gemini-1.5-flash")).not.toThrow();
        expect(() => validateModelName("GROQ_MODEL", "llama-3.1-8b-instant")).not.toThrow();
        expect(() => validateModelName("OLLAMA_MODEL", "deepseek-r1:7b")).not.toThrow();

        expect(() => validateModelName("GEMINI_MODEL", "invalid model name with spaces")).toThrow(
            "Invalid GEMINI_MODEL",
        );
        expect(() => validateModelName("GROQ_MODEL", "model;rm -rf /")).toThrow(
            "Invalid GROQ_MODEL",
        );

        expect(isLocalEndpoint("http://localhost:11434")).toBe(true);
        expect(isLocalEndpoint("http://127.0.0.1:11434")).toBe(true);
        expect(isLocalEndpoint("http://192.168.1.100:11434")).toBe(false);
        expect(isLocalEndpoint("https://my-remote-ollama.example.com")).toBe(false);
    });
});
