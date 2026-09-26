import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isIP } from "node:net";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Load .env into process.env only for keys that are not already set, so that
// explicit environment variables (e.g. from Docker `--env-file`) take priority.
const loadEnv = () => {
    const envPath = join(__dirname, "..", ".env");
    if (!existsSync(envPath)) return;
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed
            .slice(eq + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) process.env[key] = value;
    }
};
loadEnv();

// Vite inlines any VITE_* variable into the client bundle. Secrets must never
// be prefixed that way, so fail fast instead of shipping a leaked key.
const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASSPHRASE|CREDENTIAL|AUTH)/i;
const FORBIDDEN_VITE_VARS = Object.keys(process.env).filter(
    (k) => k.startsWith("VITE_") && SECRET_NAME.test(k),
);
if (FORBIDDEN_VITE_VARS.length > 0) {
    throw new Error(
        `Refusing to start: ${FORBIDDEN_VITE_VARS.join(", ")} would be exposed in the browser bundle. ` +
            `Rename them without the VITE_ prefix (see .env.example).`,
    );
}

export const CLIENT_DIR = join(__dirname, "..", "build", "client");
const rawTrustProxy = process.env.TRUSTED_PROXY_IPS || process.env.TRUST_PROXY || "";
export const TRUST_PROXY =
    rawTrustProxy === "true"
        ? true
        : rawTrustProxy && rawTrustProxy !== "false"
          ? rawTrustProxy
          : false;

if (typeof TRUST_PROXY === "string") {
    const ips = TRUST_PROXY.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (ips.length === 0) {
        throw new Error(
            "TRUSTED_PROXY_IPS must contain at least one valid IP address when specified",
        );
    }
    for (const ip of ips) {
        if (isIP(ip) === 0) {
            throw new Error(`Invalid IP address in TRUSTED_PROXY_IPS: "${ip}"`);
        }
    }
}

export const AI_PROVIDER = (process.env.AI_PROVIDER || "offline").toLowerCase();
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
export const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
export const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
export const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || "";
export const REQUIRES_AUTH = !!API_AUTH_TOKEN;

// Validate configuration at startup so the process fails fast with a clear
// message instead of running in a broken state.
const STRICT_INT_REGEX = /^\d+$/;

const parsePositiveInt = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    const trimmed = String(raw).trim();
    if (!STRICT_INT_REGEX.test(trimmed)) {
        throw new Error(`${name} must be a positive integer (got "${raw}")`);
    }
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer (got "${raw}")`);
    }
    return value;
};

const parseNonNegativeInt = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    const trimmed = String(raw).trim();
    if (!STRICT_INT_REGEX.test(trimmed)) {
        throw new Error(`${name} must be a non-negative integer (got "${raw}")`);
    }
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${name} must be a non-negative integer (got "${raw}")`);
    }
    return value;
};

export const PORT = parsePositiveInt("PORT", 3000);
export const MAX_CONCURRENT = parsePositiveInt("MAX_CONCURRENT", 4);
export const MAX_DAILY_ANALYSES = parsePositiveInt("MAX_DAILY_ANALYSES", 500);
export const MAX_RETRIES = parseNonNegativeInt("MAX_RETRIES", 2);
export const MAX_OUTPUT_TOKENS = parsePositiveInt("MAX_OUTPUT_TOKENS", 2048);
export const MAX_RESPONSE_CHARS = parsePositiveInt("MAX_RESPONSE_CHARS", 50_000);
export const MAX_PROVIDER_DURATION_MS = parsePositiveInt("MAX_PROVIDER_DURATION_MS", 55_000);
const ENABLE_HSTS = process.env.ENABLE_HSTS === "true";

const SUPPORTED_PROVIDERS = ["offline", "gemini", "groq", "ollama"];
if (!SUPPORTED_PROVIDERS.includes(AI_PROVIDER)) {
    throw new Error(
        `Unsupported AI_PROVIDER: "${AI_PROVIDER}". Use one of: ${SUPPORTED_PROVIDERS.join(", ")}`,
    );
}
const SAFE_MODEL_REGEX = /^[a-zA-Z0-9._\-/:]{1,100}$/;

export const validateModelName = (name, value) => {
    if (!value || typeof value !== "string" || !SAFE_MODEL_REGEX.test(value)) {
        throw new Error(
            `Invalid ${name}: "${value}". Must be 1-100 characters containing only alphanumeric, dots, dashes, slashes, or underscores.`,
        );
    }
};

if (AI_PROVIDER === "gemini") {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
    validateModelName("GEMINI_MODEL", GEMINI_MODEL);
}
if (AI_PROVIDER === "groq") {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is required when AI_PROVIDER=groq");
    validateModelName("GROQ_MODEL", GROQ_MODEL);
}

export const isLocalEndpoint = (urlStr) => {
    try {
        const parsed = new URL(urlStr);
        const host = parsed.hostname.replace(/^\[|\]$/g, "");
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
        return false;
    }
};

if (AI_PROVIDER === "ollama") {
    validateModelName("OLLAMA_MODEL", OLLAMA_MODEL);
    try {
        const parsed = new URL(OLLAMA_ENDPOINT);
        if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error(
                `OLLAMA_ENDPOINT must use http: or https: protocol (got "${OLLAMA_ENDPOINT}")`,
            );
        }
        if (parsed.username || parsed.password) {
            throw new Error("OLLAMA_ENDPOINT must not contain embedded user credentials");
        }
        if (parsed.search || parsed.hash) {
            throw new Error("OLLAMA_ENDPOINT must not contain query parameters or fragments");
        }
    } catch (err) {
        if (err.message.includes("OLLAMA_ENDPOINT")) throw err;
        throw new Error(`Invalid OLLAMA_ENDPOINT URL: "${OLLAMA_ENDPOINT}"`, { cause: err });
    }
}

const ALLOW_PUBLIC_AI = process.env.ALLOW_PUBLIC_AI === "true";
const isRemoteOllama = AI_PROVIDER === "ollama" && !isLocalEndpoint(OLLAMA_ENDPOINT);
const isRemoteProvider = AI_PROVIDER === "gemini" || AI_PROVIDER === "groq" || isRemoteOllama;

if (process.env.NODE_ENV === "production") {
    if (isRemoteProvider && !API_AUTH_TOKEN) {
        if (!ALLOW_PUBLIC_AI) {
            throw new Error(
                `Running remote AI provider (${AI_PROVIDER}) in production requires API_AUTH_TOKEN to prevent unauthorized quota consumption. ` +
                    "If you explicitly want a public unauthenticated AI endpoint, set ALLOW_PUBLIC_AI=true.",
            );
        }
        console.warn(
            "⚠️  [SECURITY WARNING] ALLOW_PUBLIC_AI=true is enabled! Remote AI provider is publicly accessible in production without authentication.",
        );
    }
    if (API_AUTH_TOKEN && API_AUTH_TOKEN.length < 16) {
        throw new Error("API_AUTH_TOKEN must be at least 16 characters long in production");
    }
}

// Providers that send the resume content to a third party or remote host require explicit
// user consent on every analyze request (fail closed).
export const REQUIRES_CONSENT =
    AI_PROVIDER === "gemini" ||
    AI_PROVIDER === "groq" ||
    (AI_PROVIDER === "ollama" && !isLocalEndpoint(OLLAMA_ENDPOINT));

export const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json",
};

// CSP Directive Rationale:
// - default-src 'self': Restrict all unspecified resource origins to self.
// - script-src 'self': Disallow any eval() or unvetted external scripts.
// - style-src 'self' 'unsafe-inline': Required for dynamic score gauge SVG dashoffset computations,
//   Tailwind v4 CSS runtime variables, and light/dark theme transition style attributes.
// - img-src 'self' data: blob:: Permits rendering local PDF preview canvas blobs and data URIs.
// - frame-ancestors 'none': Clickjacking defense (disallows framing).
const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join("; ");

export const applySecurityHeaders = (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (ENABLE_HSTS) {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
};
