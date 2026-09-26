import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [tailwindcss(), reactRouter()],
    // Vite 8 resolves tsconfig `paths` natively (replaces vite-tsconfig-paths).
    resolve: { tsconfigPaths: true },
});
