import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, deflateSync } from "node:zlib";
import {
    MAX_BODY_BYTES,
    RateLimiter,
    resolveSafePath,
    validatePrompt,
    getClientIp,
    parseAndValidateFeedback,
    validateAuthHeader,
} from "./lib.mjs";
import {
    AI_PROVIDER,
    API_AUTH_TOKEN,
    REQUIRES_AUTH,
    REQUIRES_CONSENT,
    TRUST_PROXY,
    CLIENT_DIR,
    PORT,
    MAX_CONCURRENT,
    MAX_DAILY_ANALYSES,
    MIME,
    applySecurityHeaders,
} from "./config.mjs";
import { runProvider, getActiveCircuitBreakerState } from "./ai.mjs";

// Re-exported so consumers keep a single import surface for the server.
export { validateModelName, isLocalEndpoint } from "./config.mjs";
export {
    AI_SYSTEM_INSTRUCTION,
    callGemini,
    callGroq,
    callOllama,
    geminiCircuitBreaker,
    groqCircuitBreaker,
    ollamaCircuitBreaker,
    runProvider,
} from "./ai.mjs";
export const rateLimiter = new RateLimiter();
// Coarse per-IP budget for every other API route (config, unknown endpoints,
// scanner traffic). The analyze route keeps its own, much tighter limiter.
export const apiRateLimiter = new RateLimiter({
    windowMs: 60_000,
    maxPerWindow: 60,
    maxPerDay: 2_000,
});
// Periodically prune the rate-limit stores so they cannot grow without bound.
const sweeper = setInterval(() => {
    rateLimiter.sweep();
    apiRateLimiter.sweep();
}, 60_000);
sweeper.unref();

let activeRequests = 0;

// Global daily budget across all IPs (in-memory; use a shared store such as
// Redis/Upstash for multiple replicas).
let globalDayKey = "";
let globalCount = 0;
const withinGlobalBudget = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== globalDayKey) {
        globalDayKey = today;
        globalCount = 0;
    }
    globalCount += 1;
    return globalCount <= MAX_DAILY_ANALYSES;
};

const sendJson = (res, status, payload) => {
    applySecurityHeaders(res);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
    });
    res.end(JSON.stringify(payload));
};

const readBody = (req) =>
    new Promise((resolve, reject) => {
        const contentLength = Number(req.headers["content-length"]);
        if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
            const err = new Error("Payload too large");
            err.statusCode = 413;
            reject(err);
            return;
        }

        let size = 0;
        const chunks = [];
        let overflow = false;

        const onData = (chunk) => {
            if (overflow) return;
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                overflow = true;
                req.removeListener("data", onData);
                req.resume();
                const err = new Error("Payload too large");
                err.statusCode = 413;
                reject(err);
                return;
            }
            chunks.push(chunk);
        };

        req.on("data", onData);
        req.on("end", () => {
            if (!overflow) resolve(Buffer.concat(chunks).toString("utf8"));
        });
        req.on("error", reject);
    });

const COMPRESSIBLE_EXTENSIONS = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt"]);

const compressionCache = new Map();

const getCompressedPayload = (filePath, body, acceptEncoding = "") => {
    const ext = extname(filePath).toLowerCase();
    if (!COMPRESSIBLE_EXTENSIONS.has(ext) || body.length < 512) {
        return { data: body, encoding: null };
    }

    const encodings = acceptEncoding.toLowerCase();
    if (encodings.includes("gzip")) {
        const cacheKey = `${filePath}:${body.length}:gzip`;
        let compressed = compressionCache.get(cacheKey);
        if (!compressed) {
            compressed = gzipSync(body, { level: 6 });
            if (compressionCache.size > 200) compressionCache.clear();
            compressionCache.set(cacheKey, compressed);
        }
        return { data: compressed, encoding: "gzip" };
    }

    if (encodings.includes("deflate")) {
        const cacheKey = `${filePath}:${body.length}:deflate`;
        let compressed = compressionCache.get(cacheKey);
        if (!compressed) {
            compressed = deflateSync(body, { level: 6 });
            if (compressionCache.size > 200) compressionCache.clear();
            compressionCache.set(cacheKey, compressed);
        }
        return { data: compressed, encoding: "deflate" };
    }

    return { data: body, encoding: null };
};

const serveStatic = async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        applySecurityHeaders(res);
        res.setHeader("Allow", "GET, HEAD");
        res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Method Not Allowed");
        return;
    }

    let pathname = new URL(req.url, "http://localhost").pathname;
    const requestedPath = pathname;
    if (pathname === "/") pathname = "/index.html";

    let filePath;
    try {
        filePath = resolveSafePath(pathname, CLIENT_DIR);
    } catch {
        applySecurityHeaders(res);
        res.writeHead(400);
        res.end("Bad Request");
        return;
    }

    if (!filePath.startsWith(CLIENT_DIR + sep) && filePath !== join(CLIENT_DIR, "index.html")) {
        applySecurityHeaders(res);
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    try {
        const info = await stat(filePath);
        if (info.isFile()) {
            const ext = extname(filePath).toLowerCase();
            if (ext === ".map" && process.env.NODE_ENV === "production") {
                applySecurityHeaders(res);
                res.writeHead(404);
                res.end("Not Found");
                return;
            }
            const body = await readFile(filePath);
            const { data: outputData, encoding } = getCompressedPayload(
                filePath,
                body,
                req.headers["accept-encoding"] || "",
            );
            applySecurityHeaders(res);
            const headers = {
                "Content-Type": MIME[ext] || "application/octet-stream",
                "Content-Length": outputData.length,
                "Cache-Control":
                    ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
                Vary: "Accept-Encoding",
            };
            if (encoding) {
                headers["Content-Encoding"] = encoding;
            }
            res.writeHead(200, headers);
            if (req.method === "HEAD") {
                res.end();
            } else {
                res.end(outputData);
            }
            return;
        }
    } catch {
        // Fall through to the SPA fallback below.
    }

    // Only fall back to the SPA shell for navigation routes (no file extension).
    // Missing static assets (e.g. /assets/app.js, /favicon.ico) must return 404
    // instead of the HTML document, to avoid masking broken asset references.
    const assetExt = extname(requestedPath).toLowerCase();
    if (assetExt || requestedPath.startsWith("/assets/")) {
        applySecurityHeaders(res);
        res.writeHead(404);
        res.end("Not Found");
        return;
    }

    try {
        const index = await readFile(join(CLIENT_DIR, "index.html"));
        const { data: outputData, encoding } = getCompressedPayload(
            "index.html",
            index,
            req.headers["accept-encoding"] || "",
        );
        applySecurityHeaders(res);
        const headers = {
            "Content-Type": MIME[".html"],
            "Content-Length": outputData.length,
            "Cache-Control": "no-cache",
            Vary: "Accept-Encoding",
        };
        if (encoding) {
            headers["Content-Encoding"] = encoding;
        }
        res.writeHead(200, headers);
        if (req.method === "HEAD") {
            res.end();
        } else {
            res.end(outputData);
        }
    } catch {
        applySecurityHeaders(res);
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Application build not found. Run `npm run build` first.");
    }
};

const logAccess = (meta) => {
    // Structured JSON log without sensitive payload or resume content
    if (process.env.NODE_ENV !== "test") {
        console.log(
            JSON.stringify({
                timestamp: new Date().toISOString(),
                circuitBreakerState: getActiveCircuitBreakerState(),
                ...meta,
            }),
        );
    }
};

// Error log shares the access-log format so it can be picked up by the same
// pipeline; never records request bodies or resume content.
const logError = (meta) => {
    if (process.env.NODE_ENV !== "test") {
        console.error(
            JSON.stringify({
                timestamp: new Date().toISOString(),
                level: "error",
                circuitBreakerState: getActiveCircuitBreakerState(),
                ...meta,
            }),
        );
    }
};

const handleRequest = async (req, res) => {
    const startTime = Date.now();
    // Server generates an authoritative UUID for tracing
    const requestId =
        typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    res.setHeader("X-Request-Id", requestId);

    // Optional client-supplied correlation ID is sanitized and echoed separately
    const rawClientRequestId = req.headers["x-client-request-id"] || req.headers["x-request-id"];
    const isValidClientRequestId =
        typeof rawClientRequestId === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(rawClientRequestId);
    if (isValidClientRequestId) {
        res.setHeader("X-Client-Request-Id", rawClientRequestId);
    }

    let url;
    try {
        url = new URL(req.url || "/", "http://localhost");
    } catch {
        applySecurityHeaders(res);
        res.writeHead(400);
        res.end("Bad Request");
        return;
    }

    res.on("finish", () => {
        if (url && (url.pathname.startsWith("/api/") || url.pathname === "/healthz")) {
            logAccess({
                requestId,
                clientRequestId: isValidClientRequestId ? rawClientRequestId : undefined,
                method: req.method,
                path: url.pathname,
                status: res.statusCode,
                durationMs: Date.now() - startTime,
                provider: AI_PROVIDER,
            });
        }
    });

    if (req.method === "OPTIONS") {
        applySecurityHeaders(res);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, x-api-key, x-request-id, x-client-request-id",
        );
        res.writeHead(204);
        res.end();
        return;
    }

    // Coarse per-IP budget for every API route, applied before any route work.
    if (url.pathname.startsWith("/api/")) {
        const clientIp = getClientIp(req, TRUST_PROXY);
        if (apiRateLimiter.check(clientIp)) {
            res.setHeader("Retry-After", "60");
            sendJson(res, 429, { error: "Too many requests" });
            return;
        }
    }

    if (url.pathname === "/api/config") {
        if (req.method !== "GET") {
            sendJson(res, 405, { error: "Method not allowed" });
            return;
        }
        sendJson(res, 200, {
            provider: AI_PROVIDER,
            requiresConsent: REQUIRES_CONSENT,
            requiresAuth: REQUIRES_AUTH,
        });
        return;
    }

    if (url.pathname === "/api/analyze") {
        if (req.method !== "POST") {
            sendJson(res, 405, { error: "Method not allowed" });
            return;
        }

        // Require Content-Type: application/json (415 Unsupported Media Type for non-JSON payloads)
        const rawContentType = req.headers["content-type"] || "";
        const mimeType = rawContentType.split(";")[0].trim().toLowerCase();
        if (mimeType !== "application/json") {
            sendJson(res, 415, {
                error: "Unsupported Media Type: Content-Type must be application/json",
            });
            return;
        }

        // Authenticate request if API_AUTH_TOKEN is configured.
        if (REQUIRES_AUTH && !validateAuthHeader(req, API_AUTH_TOKEN)) {
            sendJson(res, 401, { error: "Unauthorized" });
            return;
        }

        // Reject cross-origin browser requests (defense in depth)
        const origin = req.headers.origin;
        if (origin) {
            try {
                if (new URL(origin).host !== new URL(`http://${req.headers.host}`).host) {
                    sendJson(res, 403, {
                        error: "forbidden",
                        message: "Cross-origin request forbidden",
                    });
                    return;
                }
            } catch {
                sendJson(res, 403, {
                    error: "forbidden",
                    message: "Cross-origin request forbidden",
                });
                return;
            }
        }

        let message;
        let consent;
        try {
            const raw = await readBody(req);
            const parsed = validatePrompt(raw);
            if (parsed.error) {
                sendJson(res, 400, { error: parsed.error });
                return;
            }
            message = parsed.message;
            consent = parsed.consent;
        } catch (err) {
            const isPayloadTooLarge = err.statusCode === 413 || err.message === "Payload too large";
            sendJson(res, isPayloadTooLarge ? 413 : 400, {
                error: isPayloadTooLarge ? "Payload too large" : "Invalid JSON body",
            });
            return;
        }

        // Fail closed: never forward the resume to a third party without consent.
        if (REQUIRES_CONSENT && !consent) {
            sendJson(res, 403, { error: "consent_required", message: "Explicit consent required" });
            return;
        }

        // 1. Check IP-based rate limiting first (fails fast without consuming global budget)
        const ip = getClientIp(req, TRUST_PROXY);
        if (rateLimiter.check(ip)) {
            sendJson(res, 429, { error: "Too many requests" });
            return;
        }

        // 2. Check concurrency slot availability before consuming global budget
        if (activeRequests >= MAX_CONCURRENT) {
            sendJson(res, 503, { error: "Server busy, try again later" });
            return;
        }

        // 3. The daily AI budget only applies when rate limit and concurrency checks passed
        // and a real external provider will execute; offline requests cost nothing externally.
        if (AI_PROVIDER !== "offline" && !withinGlobalBudget()) {
            sendJson(res, 429, { error: "Daily analysis limit reached" });
            return;
        }

        const abortController = new AbortController();
        const onClose = () => {
            if (!res.writableEnded) {
                abortController.abort();
            }
        };
        req.on("close", onClose);
        req.on("aborted", onClose);
        res.on("close", onClose);

        activeRequests++;
        try {
            const content = await runProvider(message, abortController.signal);
            if (content === null) {
                sendJson(res, 200, { offline: true });
                return;
            }

            // Validate and strictly normalize the provider's payload before returning it,
            // guaranteeing that out-of-range scores, unknown properties, or oversized strings are eliminated.
            const feedback = parseAndValidateFeedback(content);
            if (!feedback) {
                sendJson(res, 502, { error: "Provider returned an invalid response" });
                return;
            }

            sendJson(res, 200, { feedback, content: JSON.stringify(feedback) });
        } catch (err) {
            if (abortController.signal.aborted) {
                return; // Client disconnected or cancelled, no need to send further response
            }
            logError({
                requestId,
                path: url.pathname,
                name: err?.name,
                message: err?.message,
            });
            if (err?.isCircuitOpen || err?.status === 503) {
                sendJson(res, 503, { error: "AI provider is temporarily unavailable" });
                return;
            }
            if (
                err?.isTimeout ||
                err?.status === 504 ||
                err?.message === "Provider time budget exceeded" ||
                err?.name === "TimeoutError"
            ) {
                sendJson(res, 504, { error: "Provider timeout" });
                return;
            }
            sendJson(res, 502, { error: "Provider error" });
        } finally {
            req.removeListener("close", onClose);
            req.removeListener("aborted", onClose);
            res.removeListener("close", onClose);
            activeRequests--;
        }
        return;
    }

    if (url.pathname === "/healthz") {
        // Deep readiness signal: still 200 while serving, 503 once the process
        // is saturated so orchestrators stop routing traffic to it.
        const heapUsedMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        const overloaded = activeRequests >= MAX_CONCURRENT;
        sendJson(res, overloaded ? 503 : 200, {
            status: overloaded ? "degraded" : "ok",
            provider: AI_PROVIDER,
            activeRequests,
            maxConcurrent: MAX_CONCURRENT,
            uptimeSec: Math.round(process.uptime()),
            heapUsedMb,
            circuitBreaker: getActiveCircuitBreakerState(),
            timestamp: new Date().toISOString(),
        });
        return;
    }

    // Unknown API routes must 404, not fall through to the SPA shell.
    if (url.pathname.startsWith("/api/")) {
        sendJson(res, 404, { error: "Not Found" });
        return;
    }

    await serveStatic(req, res);
};

export const requestHandler = async (req, res) => {
    try {
        await handleRequest(req, res);
    } catch (err) {
        logError({
            path: req.url,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
        });
        if (res.headersSent) {
            res.end();
        } else {
            applySecurityHeaders(res);
            sendJson(res, 500, { error: "Internal Server Error" });
        }
    }
};

export const server = createServer(requestHandler);

const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    clearInterval(sweeper);
    server.close(() => {
        process.exit(0);
    });
    // Force exit if connections fail to drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    // Last-resort guards: log and keep the process alive for in-flight work
    // instead of dying silently with an opaque stack trace.
    process.on("unhandledRejection", (reason) => {
        logError({ event: "unhandledRejection", message: reason?.message ?? String(reason) });
    });
    process.on("uncaughtException", (err) => {
        logError({ event: "uncaughtException", message: err?.message, stack: err?.stack });
    });

    server.listen(PORT, () => {
        console.log(
            `CVision AI server listening on http://localhost:${PORT} (provider: ${AI_PROVIDER})`,
        );
    });
}
