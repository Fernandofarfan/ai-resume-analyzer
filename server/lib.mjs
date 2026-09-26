import { join, normalize, resolve } from "node:path";
import { isIP } from "node:net";
import { MAX_BODY_BYTES, MAX_PROMPT_CHARS } from "../shared/limits.mjs";

export { MAX_BODY_BYTES, MAX_PROMPT_CHARS };
export const DEFAULT_TIMEOUT_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Sliding-window + daily quota rate limiter with an in-memory store. Entries
// are pruned automatically so the map cannot grow without bound.
export class RateLimiter {
    constructor({ windowMs = 60_000, maxPerWindow = 10, maxPerDay = 200, now = Date.now } = {}) {
        this.windowMs = windowMs;
        this.maxPerWindow = maxPerWindow;
        this.maxPerDay = maxPerDay;
        this.now = now;
        this.hits = new Map();
    }

    check(ip) {
        const now = this.now();
        let list = this.hits.get(ip) || [];
        list = list.filter((ts) => now - ts < DAY_MS);
        list.push(now);
        // Bound memory per IP so a single source cannot grow the store without
        // limit during a 24h window.
        const cap = this.maxPerDay + 1;
        if (list.length > cap) list = list.slice(-cap);
        this.hits.set(ip, list);

        const windowCount = list.filter((ts) => now - ts < this.windowMs).length;
        // `list` is already limited to the last 24h, so its length is the
        // rolling daily count.
        const dailyCount = list.length;

        return windowCount > this.maxPerWindow || dailyCount > this.maxPerDay;
    }

    // Drop stale entries so memory stays bounded.
    sweep() {
        const now = this.now();
        for (const [ip, list] of this.hits) {
            const kept = list.filter((ts) => now - ts < DAY_MS);
            if (kept.length === 0) this.hits.delete(ip);
            else this.hits.set(ip, kept);
        }
    }
}

// Circuit breaker to avoid cascading provider failures and rapid retry storms.
export class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 3;
        this.cooldownMs = options.cooldownMs || options.resetTimeout || 30_000;
        this.consecutiveFailures = 0;
        this.state = "CLOSED";
        this.openedAt = 0;
        this.halfOpenProbing = false;
        this.now = options.now || (() => Date.now());
    }

    getState() {
        if (this.state === "OPEN") {
            const elapsed = this.now() - this.openedAt;
            if (elapsed >= this.cooldownMs) {
                this.state = "HALF_OPEN";
            }
        }
        return this.state;
    }

    canExecute() {
        const current = this.getState();
        if (current === "CLOSED") return true;
        if (current === "HALF_OPEN") return !this.halfOpenProbing;
        return false;
    }

    recordSuccess() {
        this.consecutiveFailures = 0;
        this.state = "CLOSED";
        this.halfOpenProbing = false;
    }

    reset() {
        this.consecutiveFailures = 0;
        this.state = "CLOSED";
        this.openedAt = 0;
        this.halfOpenProbing = false;
    }

    recordFailure() {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.failureThreshold || this.state === "HALF_OPEN") {
            this.state = "OPEN";
            this.openedAt = this.now();
            this.halfOpenProbing = false;
        }
    }

    async execute(fn) {
        const current = this.getState();
        if (current === "OPEN" || (current === "HALF_OPEN" && this.halfOpenProbing)) {
            const err = new Error("Circuit breaker is OPEN: Provider is temporarily unavailable");
            err.status = 503;
            err.isCircuitOpen = true;
            throw err;
        }
        if (current === "HALF_OPEN") {
            this.halfOpenProbing = true;
        }
        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        } catch (err) {
            // Do not trip circuit breaker on client-side errors (4xx except 429)
            const isClientError =
                typeof err?.status === "number" &&
                err.status >= 400 &&
                err.status < 500 &&
                err.status !== 429;
            if (!isClientError) {
                this.recordFailure();
            }
            throw err;
        } finally {
            if (current === "HALF_OPEN") {
                this.halfOpenProbing = false;
            }
        }
    }
}

// fetch with a hard timeout so a stalled provider can never hold a request open
// indefinitely, while supporting active cancellation from client disconnection.
export async function fetchWithTimeout(
    url,
    options = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    callerSignal,
) {
    const controller = new AbortController();
    let isTimeout = false;
    const timer = setTimeout(() => {
        isTimeout = true;
        controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
        if (callerSignal.aborted) controller.abort(callerSignal.reason);
        else callerSignal.addEventListener("abort", onAbort, { once: true });
    }
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        if (isTimeout) {
            const timeoutErr = new Error("Provider timeout");
            timeoutErr.status = 504;
            timeoutErr.isTimeout = true;
            throw timeoutErr;
        }
        throw err;
    } finally {
        clearTimeout(timer);
        if (callerSignal) callerSignal.removeEventListener("abort", onAbort);
    }
}

// Iterative URI decoding to prevent multi-level encoding evasion (e.g. %252e%252e%252f -> %2e%2e%2f -> ../)
const decodeFully = (str) => {
    let current = String(str || "");
    for (let i = 0; i < 5; i++) {
        try {
            const next = decodeURIComponent(current);
            if (next === current) break;
            current = next;
        } catch {
            break;
        }
    }
    return current;
};

// Resolve a request pathname against the client directory while strictly preventing
// directory traversal.
export const resolveSafePath = (pathname, clientDir) => {
    const decoded = decodeFully(pathname);
    const normalized = normalize(decoded)
        .replace(/^(\.\.[/\\])+/, "")
        .replace(/^[/\\]+/, "");
    const baseDir = resolve(clientDir);
    const candidate = resolve(baseDir, normalized);
    if (!candidate.startsWith(baseDir)) {
        return join(baseDir, "index.html");
    }
    return candidate;
};

// Parse and validate the analyze request body.
export const validatePrompt = (raw) => {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { error: "Invalid JSON body" };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { error: "Invalid JSON body" };
    }
    if (typeof parsed.message !== "string" || !parsed.message.trim()) {
        return { error: "Missing 'message' field" };
    }
    if (parsed.message.length > MAX_PROMPT_CHARS) {
        return { error: "Prompt too large" };
    }
    return { message: parsed.message, consent: parsed.consent === true };
};

export const isLoopbackOrPrivate = (ip) => {
    if (!ip || typeof ip !== "string") return false;
    const clean = ip.replace(/^::ffff:/, "");
    if (clean === "127.0.0.1" || clean === "::1" || clean === "localhost") return true;
    if (isIP(clean) === 0) return false;
    if (clean.startsWith("10.") || clean.startsWith("192.168.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
    if (clean.startsWith("fc00:") || clean.startsWith("fd")) return true;
    return false;
};

export const getClientIp = (req, trustProxy) => {
    const sockIp = req.socket?.remoteAddress || "unknown";
    if (trustProxy) {
        let isTrusted;
        if (
            typeof trustProxy === "string" &&
            trustProxy !== "true" &&
            trustProxy.trim().length > 0
        ) {
            const trustedList = trustProxy.split(",").map((s) => s.trim().replace(/^::ffff:/, ""));
            const cleanSock = sockIp.replace(/^::ffff:/, "");
            isTrusted = trustedList.includes(cleanSock);
        } else {
            isTrusted = isLoopbackOrPrivate(sockIp);
        }

        if (isTrusted) {
            const forwarded = req.headers["x-forwarded-for"];
            if (typeof forwarded === "string" && forwarded.length > 0) {
                const rawIp = forwarded
                    .split(",")[0]
                    .trim()
                    .replace(/^::ffff:/, "");
                if (isIP(rawIp) !== 0) {
                    return rawIp;
                }
            }
        }
    }
    const cleanSock = sockIp.replace(/^::ffff:/, "");
    return isIP(cleanSock) !== 0 ? cleanSock : "unknown";
};

// Server-side validation of the provider's feedback payload. The client also
// validates, but the server must never return an unvalidated structure to an
// untrusted caller.
export {
    MAX_STRING_LENGTH,
    MAX_TIPS_PER_CATEGORY,
    MAX_KEYWORDS,
    MAX_BULLET_REWRITES,
    clampScore,
    parseTips,
    parseCategoryStrict,
    parseKeywords,
    parseBulletRewrites,
    validateFeedback,
    normalizeFeedback,
    validateAuthHeader,
} from "../shared/schema.mjs";

import { normalizeFeedback, validateFeedback } from "../shared/schema.mjs";

export const validateFeedbackShape = (value) => validateFeedback(value);

export const parseAndValidateFeedback = (text) => {
    if (!text || typeof text !== "string") return null;
    try {
        const cleaned = text
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "");
        return normalizeFeedback(JSON.parse(cleaned));
    } catch {
        return null;
    }
};
