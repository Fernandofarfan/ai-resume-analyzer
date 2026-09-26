import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
    {
        ignores: [
            "node_modules/**",
            "build/**",
            ".react-router/**",
            "coverage/**",
            "public/**",
            "*.config.ts",
            "app/route-config.*",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        plugins: { "react-hooks": reactHooks },
        rules: {
            ...reactHooks.configs["recommended-latest"].rules,
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
            ],
            eqeqeq: ["error", "smart"],
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "error",
            "no-var": "error",
        },
    },
    {
        files: ["**/*.{test,spec}.{ts,tsx,mjs}", "app/e2e/**", "scripts/**"],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
        rules: { "no-console": "off" },
    },
    {
        files: ["server/**/*.mjs", "shared/**/*.mjs", "scripts/**/*.mjs", "*.mjs", "*.config.ts"],
        languageOptions: { globals: { ...globals.node } },
        rules: { "no-console": "off" },
    },
    {
        files: ["app/**/*.{ts,tsx}"],
        languageOptions: { globals: { ...globals.browser } },
    },
);
