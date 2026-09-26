import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const serverSource = ["server/index.mjs", "server/config.mjs", "server/ai.mjs", "server/lib.mjs"]
    .map((f) => readFileSync(join(root, f), "utf8"))
    .join("\n");
const envExample = readFileSync(join(root, ".env.example"), "utf8");

describe("environment configuration contract", () => {
    const referenced = [
        ...new Set([...serverSource.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1])),
    ];

    it("reads env vars from the server", () => {
        expect(referenced.length).toBeGreaterThan(10);
    });

    it("documents every env var the server reads in .env.example", () => {
        const missing = referenced.filter((name) => !envExample.includes(name));
        expect(missing).toEqual([]);
    });

    it("never documents secrets with the VITE_ prefix", () => {
        const documented = [...envExample.matchAll(/^#?\s*([A-Z0-9_]+)=/gm)].map((m) => m[1]);
        const leaked = documented.filter((name) => name.startsWith("VITE_"));
        expect(leaked).toEqual([]);
    });

    it("refuses to start when a secret is exposed through a VITE_ variable", () => {
        let stderr = "";
        let status = 0;
        try {
            execFileSync(process.execPath, [join(root, "server", "index.mjs")], {
                env: { ...process.env, VITE_GEMINI_API_KEY: "leaked-key", AI_PROVIDER: "offline" },
                stdio: ["ignore", "ignore", "pipe"],
                encoding: "utf8",
                timeout: 15_000,
            });
        } catch (err) {
            status = err.status ?? 1;
            stderr = String(err.stderr ?? "");
        }
        expect(status).not.toBe(0);
        expect(stderr).toContain("VITE_GEMINI_API_KEY");
        expect(stderr).toContain("browser bundle");
    });
});
