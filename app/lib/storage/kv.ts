import type { KVItem } from "~/domain/storage";

// Real feature detection: the mere presence of `localStorage` does not mean it
// is usable (private mode, blocked cookies, sandboxed iframes, corporate
// policies, etc. can throw on access or write).
const storageAvailable = ((): boolean => {
    try {
        if (typeof localStorage === "undefined") return false;
        const probe = "__cvision_storage_test__";
        localStorage.setItem(probe, "1");
        localStorage.removeItem(probe);
        return true;
    } catch {
        return false;
    }
})();

export const kvGet = async (key: string): Promise<string | null> => {
    if (!storageAvailable) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

export const kvSet = async (key: string, value: string): Promise<boolean> => {
    if (!storageAvailable) return false;
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (err) {
        console.warn("Failed to write to localStorage (quota exceeded?)", err);
        return false;
    }
};

export const kvDelete = async (key: string): Promise<boolean> => {
    if (!storageAvailable) return false;
    try {
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
};

export const kvList = async (pattern: string, returnValues = false): Promise<string[] | KVItem[]> => {
    if (!storageAvailable) return [];
    try {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        const results: KVItem[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && regex.test(k)) {
                results.push({ key: k, value: returnValues ? localStorage.getItem(k) || "" : "" });
            }
        }
        return returnValues ? results : results.map((r) => r.key);
    } catch {
        return [];
    }
};

export const kvFlushResumeData = async (): Promise<void> => {
    if (!storageAvailable) return;
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("resume:")) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
        // Ignore — best effort cleanup.
    }
};
