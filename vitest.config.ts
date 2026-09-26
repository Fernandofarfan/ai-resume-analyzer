import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// The React Router Vite plugin expects the dev-server preamble that only exists
// when an HTML entry is served, so tests resolve the `~/*` alias on their own
// instead of loading `vite.config.ts` wholesale.
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        setupFiles: ["app/test-setup.ts"],
        coverage: {
            provider: "v8",
            all: true,
            include: ["app/domain/**", "app/lib/**", "constants/**", "shared/**", "server/**"],
            // Coverage numbers describe the logic layer (domain/lib/server).
            // React glue - routes, components and hooks - is executed by the
            // test suite but excluded from the metrics, like `app/components/**`.
            exclude: [
                "**/*.test.*",
                "**/*.d.ts",
                "**/*.d.mts",
                "app/e2e/**",
                "app/lib/hooks/**",
                "scripts/**",
            ],
            reporter: ["text", "lcov", "json-summary"],
            reportsDirectory: "coverage",
            thresholds: {
                statements: 65,
                branches: 58,
                functions: 60,
                lines: 68,
            },
        },
    },
});
