// Cross-tab coordination with optimistic versioning and Web Locks.
// Ensures that multiple tabs do not overwrite newer versions, initiate
// conflicting concurrent operations, or purge active background processes.

export interface TabSyncMessage {
    type: "resumes-changed" | "resume-updating" | "resume-deleted" | "storage-cleared";
    resumeId?: string;
    version?: number;
    updatedAt?: number;
    operationId?: string;
    sourceTabId: string;
}

const CHANNEL = "cvision-resumes";

const TAB_ID =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "tab_" + Math.random().toString(36).slice(2);

export const getTabId = (): string => TAB_ID;

export const notifyResumesChanged = (payload?: Partial<TabSyncMessage>): void => {
    try {
        const channel = new BroadcastChannel(CHANNEL);
        const message: TabSyncMessage = {
            type: payload?.type ?? "resumes-changed",
            resumeId: payload?.resumeId,
            version: payload?.version,
            updatedAt: payload?.updatedAt ?? Date.now(),
            operationId: payload?.operationId ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined),
            sourceTabId: TAB_ID,
        };
        channel.postMessage(message);
        channel.close();
    } catch {
        // BroadcastChannel unsupported or restricted — ignore gracefully.
    }
};

export const subscribeResumesChanged = (
    callback: (message: TabSyncMessage) => void
): (() => void) => {
    try {
        const channel = new BroadcastChannel(CHANNEL);
        channel.onmessage = (event) => {
            if (event.data && typeof event.data === "object") {
                callback(event.data as TabSyncMessage);
            }
        };
        return () => channel.close();
    } catch {
        return () => {};
    }
};

// Optimistic concurrency check: returns true if incoming update is strictly older
// than the currently stored record.
export const isStaleWrite = (
    incoming: { updatedAt?: number; version?: number },
    current: { updatedAt?: number; version?: number }
): boolean => {
    if (typeof incoming.version === "number" && typeof current.version === "number") {
        if (incoming.version < current.version) return true;
    }
    if (typeof incoming.updatedAt === "number" && typeof current.updatedAt === "number") {
        if (incoming.updatedAt < current.updatedAt) return true;
    }
    return false;
};

// Web Locks coordination using navigator.locks when available.
export const withTabLock = async <T>(
    lockName: string,
    callback: () => Promise<T>,
    timeoutMs = 10_000
): Promise<T> => {
    if (typeof navigator !== "undefined" && "locks" in navigator && typeof navigator.locks?.request === "function") {
        return new Promise<T>((resolve, reject) => {
            const controller = new AbortController();
            const timer = setTimeout(() => {
                controller.abort(new Error(`Acquiring lock "${lockName}" timed out`));
            }, timeoutMs);

            navigator.locks
                .request(lockName, { signal: controller.signal }, async () => {
                    clearTimeout(timer);
                    try {
                        const result = await callback();
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    // Fallback: localStorage mutex with renewable lease and owner validation
    if (typeof localStorage !== "undefined") {
        const lockKey = `tab_lock_${lockName}`;
        const ownerId = `${getTabId()}_${Math.random().toString(36).slice(2, 9)}`;
        const start = Date.now();
        const leaseDurationMs = Math.max(3000, timeoutMs);

        const parseLock = (): { ownerId: string; expiresAt: number } | null => {
            try {
                const val = localStorage.getItem(lockKey);
                if (!val) return null;
                const parsed = JSON.parse(val);
                if (typeof parsed?.ownerId === "string" && typeof parsed?.expiresAt === "number") {
                    return parsed;
                }
                return null;
            } catch {
                return null;
            }
        };

        let acquired = false;
        while (Date.now() - start < timeoutMs) {
            const currentLock = parseLock();
            const isExpired = !currentLock || currentLock.expiresAt < Date.now();

            if (isExpired) {
                const expiresAt = Date.now() + leaseDurationMs;
                localStorage.setItem(lockKey, JSON.stringify({ ownerId, expiresAt }));

                // Contention jitter verification: verify write was not overwritten by a concurrent tab
                await new Promise((r) => setTimeout(r, 15 + Math.random() * 20));
                const verifyLock = parseLock();
                if (verifyLock?.ownerId === ownerId) {
                    acquired = true;
                    break;
                }
            }
            await new Promise((r) => setTimeout(r, 40 + Math.random() * 30));
        }

        if (!acquired) {
            throw new Error(`Acquiring fallback lock "${lockName}" timed out`);
        }

        // Heartbeat interval to renew lease for long-running executions (e.g. bulk backup import)
        const renewInterval = Math.max(1000, Math.floor(leaseDurationMs / 3));
        const heartbeatTimer = setInterval(() => {
            const current = parseLock();
            if (current?.ownerId === ownerId) {
                localStorage.setItem(
                    lockKey,
                    JSON.stringify({ ownerId, expiresAt: Date.now() + leaseDurationMs })
                );
            } else {
                clearInterval(heartbeatTimer);
            }
        }, renewInterval);

        try {
            return await callback();
        } finally {
            clearInterval(heartbeatTimer);
            const finalLock = parseLock();
            if (finalLock?.ownerId === ownerId) {
                localStorage.removeItem(lockKey);
            }
        }
    }

    return await callback();
};
