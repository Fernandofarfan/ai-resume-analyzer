import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library only auto-registers cleanup when the test runner
// exposes globals, which this project does not enable.
afterEach(() => {
    cleanup();
});
