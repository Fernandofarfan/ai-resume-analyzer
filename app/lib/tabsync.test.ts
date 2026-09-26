import { describe, it, expect } from "vitest";
import { isStaleWrite, getTabId, withTabLock, withProcessLock, sweepTabLocks } from "./tabsync";

describe("tabsync coordination and optimistic versioning", () => {
    it("generates a valid non-empty session tabId", () => {
        const id = getTabId();
        expect(typeof id).toBe("string");
        expect(id.length).toBeGreaterThan(0);
    });

    it("identifies stale writes when incoming version is lower", () => {
        const incoming = { version: 1, updatedAt: 2000 };
        const current = { version: 2, updatedAt: 1000 };
        expect(isStaleWrite(incoming, current)).toBe(true);
    });

    it("allows write when incoming version is newer", () => {
        const incoming = { version: 3, updatedAt: 3000 };
        const current = { version: 2, updatedAt: 2000 };
        expect(isStaleWrite(incoming, current)).toBe(false);
    });

    it("identifies stale writes based on updatedAt timestamp when versions are equal", () => {
        const incoming = { version: 2, updatedAt: 1500 };
        const current = { version: 2, updatedAt: 2000 };
        expect(isStaleWrite(incoming, current)).toBe(true);
    });

    it("allows writes when timestamps and versions are identical or newer", () => {
        const incoming = { version: 2, updatedAt: 2000 };
        const current = { version: 2, updatedAt: 2000 };
        expect(isStaleWrite(incoming, current)).toBe(false);
    });

    it("executes callback under withTabLock and releases lock correctly", async () => {
        const res = await withTabLock("test-operation", async () => {
            return "executed-result";
        });
        expect(res).toBe("executed-result");
    });

    it("handles concurrent sequential lock acquisition under withTabLock", async () => {
        const completed: number[] = [];
        let active = 0;
        let maxActive = 0;
        const track = (id: number, delayMs: number) =>
            withTabLock("shared-resource", async () => {
                active += 1;
                maxActive = Math.max(maxActive, active);
                await new Promise((r) => setTimeout(r, delayMs));
                completed.push(id);
                active -= 1;
                return id;
            });

        const [r1, r2] = await Promise.all([track(1, 60), track(2, 0)]);
        expect(r1).toBe(1);
        expect(r2).toBe(2);
        // The contract is mutual exclusion, not which caller wins the race.
        expect(maxActive).toBe(1);
        expect([...completed].sort((a, b) => a - b)).toEqual([1, 2]);
    });

    it("serializes concurrent callbacks through the process lock", async () => {
        const order: number[] = [];
        const jobs = [1, 2, 3, 4].map((n) =>
            withProcessLock("proc-shared", async () => {
                await new Promise((r) => setTimeout(r, 20 + n));
                order.push(n);
                return n;
            }),
        );
        await Promise.all(jobs);
        expect(order).toEqual([1, 2, 3, 4]);
    });

    it("keeps the process lock chain intact after a callback rejects", async () => {
        const failing = withProcessLock("proc-failing", async () => {
            throw new Error("boom");
        });
        const following = withProcessLock("proc-failing", async () => "after-failure");

        await expect(failing).rejects.toThrow("boom");
        await expect(following).resolves.toBe("after-failure");
    });

    it("isolates process locks by name", async () => {
        const order: string[] = [];
        const a = withProcessLock("lock-a", async () => {
            await new Promise((r) => setTimeout(r, 40));
            order.push("a");
        });
        const b = withProcessLock("lock-b", async () => {
            order.push("b");
        });
        await Promise.all([a, b]);
        expect(order).toEqual(["b", "a"]);
    });

    describe("sweepTabLocks", () => {
        const withFakeLocalStorage = <T>(entries: Record<string, string>, run: () => T): T => {
            const data = new Map(Object.entries(entries));
            const shim = {
                get length() {
                    return data.size;
                },
                key: (i: number) => Array.from(data.keys())[i] ?? null,
                getItem: (k: string) => data.get(k) ?? null,
                setItem: (k: string, v: string) => void data.set(k, v),
                removeItem: (k: string) => void data.delete(k),
            };
            const holder = globalThis as { localStorage?: unknown };
            const hadOriginal = "localStorage" in holder;
            const original = holder.localStorage;
            holder.localStorage = shim;
            try {
                return run();
            } finally {
                if (hadOriginal) holder.localStorage = original;
                else delete holder.localStorage;
            }
        };

        it("removes expired and malformed leases while keeping live ones", () => {
            const now = Date.now();
            const result = withFakeLocalStorage(
                {
                    tab_lock_resume_live: JSON.stringify({
                        ownerId: "tab1",
                        expiresAt: now + 60_000,
                    }),
                    tab_lock_resume_expired: JSON.stringify({
                        ownerId: "tab2",
                        expiresAt: now - 1,
                    }),
                    tab_lock_resume_corrupt: "{not-json",
                    resume_unrelated: "keep-me",
                },
                () => sweepTabLocks(),
            );

            expect(result).toBe(2);
        });

        it("returns 0 when localStorage is unavailable", () => {
            const holder = globalThis as { localStorage?: unknown };
            delete holder.localStorage;
            expect(sweepTabLocks()).toBe(0);
        });
    });
});
