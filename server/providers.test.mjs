import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { CircuitBreaker, parseAndValidateFeedback } from "./lib.mjs";
import { AI_SYSTEM_INSTRUCTION, callGemini, callGroq, callOllama } from "./index.mjs";

describe("Remote AI Provider Request Formatting & Safety Directives", () => {
    it("exports strict AI_SYSTEM_INSTRUCTION containing untrusted data safety directives", () => {
        expect(AI_SYSTEM_INSTRUCTION).toBeDefined();
        expect(AI_SYSTEM_INSTRUCTION).toContain("untrusted data");
        expect(AI_SYSTEM_INSTRUCTION).toContain("ATS");
        expect(AI_SYSTEM_INSTRUCTION).toContain("JSON response");
    });

    it("invokes real callGemini adapter against mock server verifying systemInstruction and API key", async () => {
        let capturedRequest = null;
        const mockGeminiServer = createServer((req, res) => {
            let body = "";
            req.on("data", (chunk) => {
                body += chunk;
            });
            req.on("end", () => {
                capturedRequest = {
                    url: req.url,
                    headers: req.headers,
                    body: JSON.parse(body),
                };
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        candidates: [
                            {
                                content: {
                                    parts: [
                                        {
                                            text: JSON.stringify({
                                                overallScore: 88,
                                                ATS: { score: 85, tips: [] },
                                                toneAndStyle: { score: 90, tips: [] },
                                                content: { score: 87, tips: [] },
                                                structure: { score: 90, tips: [] },
                                                skills: { score: 88, tips: [] },
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
        const port = mockGeminiServer.address().port;
        const endpoint = `http://127.0.0.1:${port}/v1beta/models/gemini-1.5-flash:generateContent`;

        try {
            const promptMessage = "Candidate Resume Text Content";
            const text = await callGemini(promptMessage, 5000, undefined, {
                endpoint,
                apiKey: "test-gemini-key",
            });

            expect(text).toContain("overallScore");
            expect(capturedRequest).not.toBeNull();
            expect(capturedRequest.headers["x-goog-api-key"]).toBe("test-gemini-key");
            expect(capturedRequest.body.systemInstruction.parts[0].text).toBe(
                AI_SYSTEM_INSTRUCTION,
            );
            expect(capturedRequest.body.contents[0].parts[0].text).toBe(promptMessage);
        } finally {
            await new Promise((resolve) => mockGeminiServer.close(resolve));
        }
    });

    it("invokes real callGroq adapter against mock server verifying system role and bearer auth", async () => {
        let capturedRequest = null;
        const mockGroqServer = createServer((req, res) => {
            let body = "";
            req.on("data", (chunk) => {
                body += chunk;
            });
            req.on("end", () => {
                capturedRequest = {
                    headers: req.headers,
                    body: JSON.parse(body),
                };
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        choices: [
                            {
                                message: {
                                    content: JSON.stringify({
                                        overallScore: 92,
                                        ATS: { score: 90, tips: [] },
                                        toneAndStyle: { score: 95, tips: [] },
                                        content: { score: 92, tips: [] },
                                        structure: { score: 90, tips: [] },
                                        skills: { score: 93, tips: [] },
                                    }),
                                },
                            },
                        ],
                    }),
                );
            });
        });

        await new Promise((resolve) => mockGroqServer.listen(0, "127.0.0.1", resolve));
        const port = mockGroqServer.address().port;
        const endpoint = `http://127.0.0.1:${port}/openai/v1/chat/completions`;

        try {
            const promptMessage = "Groq candidate prompt";
            const text = await callGroq(promptMessage, 5000, undefined, {
                endpoint,
                apiKey: "test-groq-key",
            });

            expect(text).toContain("overallScore");
            expect(capturedRequest.headers.authorization).toBe("Bearer test-groq-key");
            expect(capturedRequest.body.messages[0].role).toBe("system");
            expect(capturedRequest.body.messages[0].content).toBe(AI_SYSTEM_INSTRUCTION);
            expect(capturedRequest.body.messages[1].role).toBe("user");
            expect(capturedRequest.body.messages[1].content).toBe(promptMessage);
        } finally {
            await new Promise((resolve) => mockGroqServer.close(resolve));
        }
    });

    it("invokes real callOllama adapter against mock server verifying system parameter", async () => {
        let capturedRequest = null;
        const mockOllamaServer = createServer((req, res) => {
            let body = "";
            req.on("data", (chunk) => {
                body += chunk;
            });
            req.on("end", () => {
                capturedRequest = {
                    body: JSON.parse(body),
                };
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        response: JSON.stringify({
                            overallScore: 78,
                            ATS: { score: 75, tips: [] },
                            toneAndStyle: { score: 80, tips: [] },
                            content: { score: 78, tips: [] },
                            structure: { score: 80, tips: [] },
                            skills: { score: 77, tips: [] },
                        }),
                    }),
                );
            });
        });

        await new Promise((resolve) => mockOllamaServer.listen(0, "127.0.0.1", resolve));
        const port = mockOllamaServer.address().port;
        const endpoint = `http://127.0.0.1:${port}/api/generate`;

        try {
            const promptMessage = "Ollama prompt";
            const text = await callOllama(promptMessage, 5000, undefined, {
                endpoint,
            });

            expect(text).toContain("overallScore");
            expect(capturedRequest.body.system).toBe(AI_SYSTEM_INSTRUCTION);
            expect(capturedRequest.body.prompt).toBe(promptMessage);
        } finally {
            await new Promise((resolve) => mockOllamaServer.close(resolve));
        }
    });
});

describe("Provider Circuit Breaker & Fail-Fast Mechanics", () => {
    it("handles consecutive 503/429 errors, trips open, and resets on subsequent recovery", async () => {
        let callCount = 0;
        let fail = true;
        let fakeNow = 10000;

        const cb = new CircuitBreaker({
            failureThreshold: 2,
            cooldownMs: 5000,
            now: () => fakeNow,
        });

        const unreliableProvider = async () => {
            callCount++;
            if (fail)
                throw Object.assign(new Error("Upstream 503 Service Unavailable"), { status: 503 });
            return "success-result";
        };

        // Attempt 1: failure 1
        await expect(cb.execute(unreliableProvider)).rejects.toThrow("503");
        expect(cb.getState()).toBe("CLOSED");

        // Attempt 2: failure 2 -> trips to OPEN
        await expect(cb.execute(unreliableProvider)).rejects.toThrow("503");
        expect(cb.getState()).toBe("OPEN");

        // Attempt 3: Immediate fast-fail without invoking provider
        await expect(cb.execute(unreliableProvider)).rejects.toMatchObject({
            status: 503,
            isCircuitOpen: true,
        });
        expect(callCount).toBe(2); // Was NOT called

        // Fast-forward past cooldown
        fakeNow += 6000;
        expect(cb.getState()).toBe("HALF_OPEN");

        // Provider recovers
        fail = false;
        const res = await cb.execute(unreliableProvider);
        expect(res).toBe("success-result");
        expect(cb.getState()).toBe("CLOSED");
    });

    it("maps provider invalid JSON or corrupted payload cleanly", () => {
        const corruptPayload = "{ not valid json";
        const res = parseAndValidateFeedback(corruptPayload);
        expect(res).toBeNull();

        const schemaMismatchPayload = JSON.stringify({ foo: "bar" });
        const resMismatch = parseAndValidateFeedback(schemaMismatchPayload);
        expect(resMismatch).toBeNull();
    });
});
