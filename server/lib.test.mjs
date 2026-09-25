import { describe, it, expect } from "vitest";
import { relative } from "node:path";
import {
    resolveSafePath,
    RateLimiter,
    CircuitBreaker,
    fetchWithTimeout,
    validatePrompt,
    validateFeedbackShape,
    parseAndValidateFeedback,
    validateAuthHeader,
    getClientIp,
    isLoopbackOrPrivate,
    MAX_PROMPT_CHARS,
} from "./lib.mjs";

const CLIENT = "/app/build/client";

describe("resolveSafePath", () => {
    it("resolves a normal asset path within the client dir", () => {
        const resolved = resolveSafePath("/assets/app.js", CLIENT);
        expect(relative(CLIENT, resolved)).not.toMatch(/^\.\./);
        expect(resolved).toContain("app.js");
    });

    it("blocks directory traversal", () => {
        const resolved = resolveSafePath("/../../etc/passwd", CLIENT);
        expect(relative(CLIENT, resolved)).not.toMatch(/^\.\./);
    });

    it("blocks double-encoded directory traversal", () => {
        const resolved = resolveSafePath("/%252e%252e%252f%252e%252e%252fetc/passwd", CLIENT);
        expect(relative(CLIENT, resolved)).not.toMatch(/^\.\./);
    });
});

describe("RateLimiter", () => {
    it("allows requests within the window and blocks excess", () => {
        const limiter = new RateLimiter({ windowMs: 60000, maxPerWindow: 3, maxPerDay: 100, now: () => 1000 });
        expect(limiter.check("1.2.3.4")).toBe(false);
        expect(limiter.check("1.2.3.4")).toBe(false);
        expect(limiter.check("1.2.3.4")).toBe(false);
        expect(limiter.check("1.2.3.4")).toBe(true);
    });

    it("tracks each IP independently", () => {
        const limiter = new RateLimiter({ windowMs: 60000, maxPerWindow: 1, maxPerDay: 100, now: () => 1000 });
        expect(limiter.check("a")).toBe(false);
        expect(limiter.check("b")).toBe(false);
        expect(limiter.check("a")).toBe(true);
    });

    it("enforces a rolling daily quota", () => {
        const limiter = new RateLimiter({ windowMs: 60000, maxPerWindow: 100, maxPerDay: 2, now: () => 1000 });
        expect(limiter.check("ip")).toBe(false);
        expect(limiter.check("ip")).toBe(false);
        expect(limiter.check("ip")).toBe(true);
    });

    it("sweeps stale entries", () => {
        const limiter = new RateLimiter({ windowMs: 60000, maxPerWindow: 1, maxPerDay: 100, now: () => 1000 });
        limiter.check("ip");
        expect(limiter.hits.has("ip")).toBe(true);
        limiter.now = () => 1000 + 25 * 3600 * 1000;
        limiter.sweep();
        expect(limiter.hits.has("ip")).toBe(false);
    });

    it("bounds per-IP memory growth during an attack", () => {
        const limiter = new RateLimiter({ windowMs: 60000, maxPerWindow: 1000, maxPerDay: 5, now: () => 1000 });
        for (let i = 0; i < 100; i++) limiter.check("ip");
        expect(limiter.hits.get("ip").length).toBeLessThanOrEqual(6);
    });
});

describe("validatePrompt", () => {
    it("accepts a valid message", () => {
        expect(validatePrompt(JSON.stringify({ message: "hello" })).message).toBe("hello");
    });

    it("extracts the consent flag", () => {
        expect(validatePrompt(JSON.stringify({ message: "hi", consent: true })).consent).toBe(true);
        expect(validatePrompt(JSON.stringify({ message: "hi" })).consent).toBe(false);
    });

    it("rejects invalid JSON", () => {
        expect(validatePrompt("not json").error).toBe("Invalid JSON body");
    });

    it("rejects a missing message", () => {
        expect(validatePrompt(JSON.stringify({})).error).toBe("Missing 'message' field");
    });

    it("rejects an oversized prompt", () => {
        expect(validatePrompt(JSON.stringify({ message: "x".repeat(MAX_PROMPT_CHARS + 1) })).error).toBe("Prompt too large");
    });
});

describe("validateFeedbackShape and normalizeFeedback", () => {
    const valid = {
        overallScore: 80,
        ATS: { score: 75, tips: [{ type: "good", tip: "Great structure" }] },
        toneAndStyle: { score: 85, tips: [{ type: "improve", tip: "Action verbs", explanation: "Use led, built" }] },
        content: { score: 90, tips: [] },
        structure: { score: 70, tips: [] },
        skills: { score: 80, tips: [] },
        keywords: { matchScore: 60, matching: ["React", "TypeScript"], missing: ["Node.js"] },
        bulletRewrites: [{ originalTip: "Old", suggestedRewrite: "New", reasoning: "Impact" }],
        arbitraryUnknownField: "should be stripped",
    };

    it("accepts a valid payload and strips arbitrary unknown fields", () => {
        const normalized = validateFeedbackShape(valid);
        expect(normalized).not.toBeNull();
        expect(normalized.overallScore).toBe(80);
        expect(normalized.arbitraryUnknownField).toBeUndefined();
        expect(normalized.keywords.matching).toEqual(["React", "TypeScript"]);
        expect(normalized.bulletRewrites.length).toBe(1);
    });

    it("clamps out-of-range scores to 0-100", () => {
        const outOfRange = {
            ...valid,
            overallScore: 150,
            ATS: { score: -20, tips: [] },
            content: { score: 999, tips: [] },
        };
        const normalized = validateFeedbackShape(outOfRange);
        expect(normalized.overallScore).toBe(100);
        expect(normalized.ATS.score).toBe(0);
        expect(normalized.content.score).toBe(100);
    });

    it("filters out invalid tip types or empty tips", () => {
        const withBadTips = {
            ...valid,
            ATS: {
                score: 80,
                tips: [
                    { type: "invalid_type", tip: "Should be dropped" },
                    { type: "good", tip: "" },
                    { type: "good", tip: "Valid tip" },
                ],
            },
        };
        const normalized = validateFeedbackShape(withBadTips);
        expect(normalized.ATS.tips.length).toBe(1);
        expect(normalized.ATS.tips[0].tip).toBe("Valid tip");
    });

    it("rejects a payload missing a required category", () => {
        expect(validateFeedbackShape({ overallScore: 80 })).toBeNull();
    });

    it("rejects a non-numeric category score", () => {
        expect(validateFeedbackShape({ ...valid, ATS: { score: "high" } })).toBeNull();
    });
});

describe("parseAndValidateFeedback", () => {
    it("parses JSON and strips markdown fences", () => {
        const json = JSON.stringify({
            overallScore: 80,
            ATS: { score: 70 },
            toneAndStyle: { score: 80 },
            content: { score: 90 },
            structure: { score: 75 },
            skills: { score: 85 },
        });
        const parsed = parseAndValidateFeedback("```json\n" + json + "\n```");
        expect(parsed).not.toBeNull();
        expect(parsed.overallScore).toBe(80);
    });

    it("returns null for invalid JSON or empty input", () => {
        expect(parseAndValidateFeedback("not json")).toBeNull();
        expect(parseAndValidateFeedback("")).toBeNull();
        expect(parseAndValidateFeedback(null)).toBeNull();
    });
});

describe("validateAuthHeader", () => {
    it("allows any request when no expectedToken is configured", () => {
        expect(validateAuthHeader({ headers: {} }, "")).toBe(true);
        expect(validateAuthHeader({ headers: {} }, undefined)).toBe(true);
    });

    it("accepts valid Bearer token", () => {
        const req = { headers: { authorization: "Bearer secret-token-123" } };
        expect(validateAuthHeader(req, "secret-token-123")).toBe(true);
    });

    it("accepts valid x-api-key header", () => {
        const req = { headers: { "x-api-key": "secret-token-123" } };
        expect(validateAuthHeader(req, "secret-token-123")).toBe(true);
    });

    it("rejects missing or mismatched token when expectedToken is set", () => {
        expect(validateAuthHeader({ headers: {} }, "secret-token-123")).toBe(false);
        expect(validateAuthHeader({ headers: { authorization: "Bearer wrong" } }, "secret-token-123")).toBe(false);
        expect(validateAuthHeader({ headers: { "x-api-key": "wrong" } }, "secret-token-123")).toBe(false);
    });
});

describe("CircuitBreaker", () => {
    it("starts in CLOSED state and executes successful calls", async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 5000 });
        expect(cb.getState()).toBe("CLOSED");
        const res = await cb.execute(async () => "ok");
        expect(res).toBe("ok");
        expect(cb.getState()).toBe("CLOSED");
    });

    it("trips to OPEN after consecutive failures and fast-fails with 503", async () => {
        let fakeNow = 1000;
        const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 5000, now: () => fakeNow });

        await expect(cb.execute(async () => { throw new Error("fail 1"); })).rejects.toThrow("fail 1");
        expect(cb.getState()).toBe("CLOSED");

        await expect(cb.execute(async () => { throw new Error("fail 2"); })).rejects.toThrow("fail 2");
        expect(cb.getState()).toBe("OPEN");

        // Fast-fails immediately without calling fn
        let executed = false;
        await expect(cb.execute(async () => { executed = true; })).rejects.toMatchObject({
            status: 503,
            isCircuitOpen: true,
        });
        expect(executed).toBe(false);

        // Advance past cooldown -> transitions to HALF_OPEN
        fakeNow += 6000;
        expect(cb.getState()).toBe("HALF_OPEN");

        // Successful probe resets back to CLOSED
        const probeRes = await cb.execute(async () => "recovered");
        expect(probeRes).toBe("recovered");
        expect(cb.getState()).toBe("CLOSED");
    });

    it("does not trip circuit on client-side 4xx errors (e.g. 400, 404) but trips on 5xx and 429", async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 5000 });

        // 400 Bad Request should not count as provider failure
        await expect(cb.execute(async () => {
            throw Object.assign(new Error("Bad user prompt"), { status: 400 });
        })).rejects.toThrow("Bad user prompt");
        expect(cb.getState()).toBe("CLOSED");

        // 404 Not Found should not count as provider failure
        await expect(cb.execute(async () => {
            throw Object.assign(new Error("Resource not found"), { status: 404 });
        })).rejects.toThrow("Resource not found");
        expect(cb.getState()).toBe("CLOSED");

        // 502 Bad Gateway counts as provider failure
        await expect(cb.execute(async () => {
            throw Object.assign(new Error("Provider 502"), { status: 502 });
        })).rejects.toThrow("Provider 502");
        expect(cb.getState()).toBe("CLOSED");

        // 503 Gateway Timeout triggers trip to OPEN
        await expect(cb.execute(async () => {
            throw Object.assign(new Error("Provider 503"), { status: 503 });
        })).rejects.toThrow("Provider 503");
        expect(cb.getState()).toBe("OPEN");
    });

    it("allows only a single probe when in HALF_OPEN state and rejects concurrent callers", async () => {
        let fakeNow = 1000;
        const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 5000, now: () => fakeNow });

        await expect(cb.execute(async () => { throw new Error("trip"); })).rejects.toThrow("trip");
        expect(cb.getState()).toBe("OPEN");

        fakeNow += 6000;
        expect(cb.getState()).toBe("HALF_OPEN");

        let releaseProbe;
        const probePromise = new Promise((resolve) => { releaseProbe = resolve; });

        // Start the first probe
        const firstProbe = cb.execute(async () => {
            await probePromise;
            return "recovered";
        });

        // Second caller attempts while first probe is in flight
        await expect(cb.execute(async () => "concurrent")).rejects.toMatchObject({
            status: 503,
            isCircuitOpen: true,
        });

        // Finish first probe
        releaseProbe();
        const result = await firstProbe;
        expect(result).toBe("recovered");
        expect(cb.getState()).toBe("CLOSED");
    });
});

describe("fetchWithTimeout", () => {
    it("throws 504 Provider timeout when timer expires", async () => {
        // Target an unroutable address with 1ms timeout
        await expect(fetchWithTimeout("http://10.255.255.1:81/test", {}, 1)).rejects.toMatchObject({
            status: 504,
            isTimeout: true,
            message: "Provider timeout",
        });
    });

    it("respects caller cancellation without marking as timeout", async () => {
        const controller = new AbortController();
        controller.abort("User cancelled");
        await expect(fetchWithTimeout("http://10.255.255.1:81/test", {}, 5000, controller.signal)).rejects.not.toMatchObject({
            status: 504,
            isTimeout: true,
        });
    });
});

describe("isLoopbackOrPrivate", () => {
    it("identifies localhost and IPv4/IPv6 private ranges", () => {
        expect(isLoopbackOrPrivate("127.0.0.1")).toBe(true);
        expect(isLoopbackOrPrivate("::1")).toBe(true);
        expect(isLoopbackOrPrivate("::ffff:127.0.0.1")).toBe(true);
        expect(isLoopbackOrPrivate("10.0.0.5")).toBe(true);
        expect(isLoopbackOrPrivate("192.168.1.100")).toBe(true);
        expect(isLoopbackOrPrivate("172.20.0.1")).toBe(true);
    });

    it("rejects public routable IPs", () => {
        expect(isLoopbackOrPrivate("8.8.8.8")).toBe(false);
        expect(isLoopbackOrPrivate("1.1.1.1")).toBe(false);
        expect(isLoopbackOrPrivate("203.0.113.195")).toBe(false);
        expect(isLoopbackOrPrivate("")).toBe(false);
        expect(isLoopbackOrPrivate(null)).toBe(false);
    });
});

describe("getClientIp", () => {
    it("returns socket IP directly when trustProxy is disabled", () => {
        const req = {
            socket: { remoteAddress: "203.0.113.50" },
            headers: { "x-forwarded-for": "198.51.100.10" },
        };
        expect(getClientIp(req, false)).toBe("203.0.113.50");
    });

    it("trusts x-forwarded-for when socket IP is a private/loopback proxy", () => {
        const req = {
            socket: { remoteAddress: "127.0.0.1" },
            headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.1" },
        };
        expect(getClientIp(req, true)).toBe("198.51.100.10");
    });

    it("ignores x-forwarded-for when socket IP is untrusted public address even with trustProxy=true", () => {
        const req = {
            socket: { remoteAddress: "198.51.100.99" },
            headers: { "x-forwarded-for": "1.2.3.4" },
        };
        expect(getClientIp(req, true)).toBe("198.51.100.99");
    });

    it("supports explicit trusted proxy list", () => {
        const trustedProxyList = "10.0.0.50, 198.51.100.99";
        const reqTrusted = {
            socket: { remoteAddress: "198.51.100.99" },
            headers: { "x-forwarded-for": "1.2.3.4" },
        };
        expect(getClientIp(reqTrusted, trustedProxyList)).toBe("1.2.3.4");

        const reqUntrusted = {
            socket: { remoteAddress: "203.0.113.88" },
            headers: { "x-forwarded-for": "1.2.3.4" },
        };
        expect(getClientIp(reqUntrusted, trustedProxyList)).toBe("203.0.113.88");
    });
});
