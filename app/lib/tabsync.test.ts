import { describe, it, expect } from "vitest";
import { isStaleWrite, getTabId, withTabLock } from "./tabsync";

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
        const order: number[] = [];
        const p1 = withTabLock("shared-resource", async () => {
            await new Promise((r) => setTimeout(r, 60));
            order.push(1);
            return 1;
        });
        const p2 = withTabLock("shared-resource", async () => {
            order.push(2);
            return 2;
        });

        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1).toBe(1);
        expect(r2).toBe(2);
        expect(order).toEqual([1, 2]);
    });
});
