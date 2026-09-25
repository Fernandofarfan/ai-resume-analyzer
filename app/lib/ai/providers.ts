// Client-side AI integration. No API keys or secret configuration ever reach
// the browser. Remote inference is delegated to the server-side `/api/analyze`
// endpoint, which holds provider credentials, enforces limits, and validates
// consent. When the app is served statically (no server) or the provider is
// offline, a heuristic fallback is used instead.

export type AIProvider = "offline" | "gemini" | "groq" | "ollama";
export type ProviderStatus = "ready" | "offline" | "server-unavailable";

export interface ProviderConfig {
    provider: AIProvider;
    requiresConsent: boolean;
    requiresAuth?: boolean;
    // False when the server config could not be determined (fail-closed).
    known: boolean;
    status: ProviderStatus;
}

const KNOWN_PROVIDERS: AIProvider[] = ["offline", "gemini", "groq", "ollama"];

export class UnauthorizedError extends Error {
    constructor(message = "Unauthorized: Server requires an API authentication token") {
        super(message);
        this.name = "UnauthorizedError";
    }
}

export class OfflineModeError extends Error {
    constructor() {
        super("Remote AI is not configured; use the offline heuristic engine");
        this.name = "OfflineModeError";
    }
}

export class ConsentRequiredError extends Error {
    constructor() {
        super("Consent is required before sending data to a remote provider");
        this.name = "ConsentRequiredError";
    }
}

export class AnalysisTimeoutError extends Error {
    constructor() {
        super("The AI provider is taking too long");
        this.name = "AnalysisTimeoutError";
    }
}

const CLIENT_TIMEOUT_MS = 60_000;

const safeGetSessionStorage = (key: string): string | null => {
    try {
        if (typeof sessionStorage !== "undefined") {
            return sessionStorage.getItem(key);
        }
    } catch {
        // Storage disabled or blocked
    }
    return null;
};

export const fetchProviderConfig = async (signal?: AbortSignal): Promise<ProviderConfig> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const onAbort = () => controller.abort(signal?.reason);
    if (signal) {
        if (signal.aborted) controller.abort(signal.reason);
        else signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
        const res = await fetch("/api/config", { signal: controller.signal });
        if (res.ok) {
            const data = (await res.json()) as { provider?: unknown; requiresConsent?: unknown; requiresAuth?: unknown };
            const provider = KNOWN_PROVIDERS.includes(data.provider as AIProvider)
                ? (data.provider as AIProvider)
                : "offline";
            return {
                provider,
                requiresConsent: data.requiresConsent === true || provider === "gemini" || provider === "groq",
                requiresAuth: data.requiresAuth === true,
                known: true,
                status: provider === "offline" ? "offline" : "ready",
            };
        }
    } catch {
        // Static hosting or server unavailable / timed out
    } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
    }
    // If the backend is unavailable or running purely offline (e.g. static hosting or npm run dev),
    // default to offline heuristic without forcing unnecessary remote consent.
    return { provider: "offline", requiresConsent: false, requiresAuth: false, known: false, status: "server-unavailable" };
};

export const requestRemoteAnalysis = async (
    message: string,
    consent: boolean,
    signal?: AbortSignal
): Promise<string> => {
    // Combine the caller's cancellation signal with a client-side timeout so a
    // request can never hang indefinitely even if the server misbehaves.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    const onCallerAbort = () => controller.abort(signal?.reason);
    if (signal) {
        if (signal.aborted) controller.abort(signal.reason);
        else signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const customApiKey = safeGetSessionStorage("cvision_api_key");
    if (customApiKey && customApiKey.trim()) {
        headers["x-api-key"] = customApiKey.trim();
    }

    let res: Response;
    try {
        res = await fetch("/api/analyze", {
            method: "POST",
            headers,
            body: JSON.stringify({ message, consent }),
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            if (signal?.aborted) throw err; // caller cancelled
            throw new AnalysisTimeoutError();
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener("abort", onCallerAbort);
    }

    if (res.status === 401) {
        throw new UnauthorizedError();
    }
    if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (body?.error === "consent_required" || body?.error === "Consent required") {
            throw new ConsentRequiredError();
        }
        throw new Error(body?.message || body?.error || "Forbidden");
    }
    if (!res.ok) {
        throw new Error(`Analysis endpoint returned ${res.status}`);
    }

    const data = (await res.json()) as {
        offline?: boolean;
        content?: unknown;
        feedback?: unknown;
        error?: unknown;
    };
    if (data.offline) {
        throw new OfflineModeError();
    }
    if (typeof data.content === "string" && data.content.length > 0) {
        return data.content;
    }
    if (data.feedback && typeof data.feedback === "object") {
        return JSON.stringify(data.feedback);
    }
    throw new Error(typeof data.error === "string" ? data.error : "Empty analysis result");
};
