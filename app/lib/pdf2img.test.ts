import { describe, it, expect } from "vitest";
import { buildPageText, detectColumns } from "./pdf2img";

describe("PDF text extraction and multi-column heuristics", () => {
    describe("buildPageText", () => {
        it("reconstructs single-column text in top-to-bottom reading order", () => {
            const items = [
                { str: "Jane Doe", transform: [1, 0, 0, 1, 50, 700] },
                { str: "Senior Software Engineer", transform: [1, 0, 0, 1, 50, 680] },
                { str: "Experience", transform: [1, 0, 0, 1, 50, 640] },
                { str: "Tech Corp - Lead Architect", transform: [1, 0, 0, 1, 50, 620] },
            ];

            const text = buildPageText(items);
            expect(text).toBe(
                "Jane Doe\nSenior Software Engineer\nExperience\nTech Corp - Lead Architect",
            );
        });

        it("concatenates tokens on the same horizontal line with spaces", () => {
            const items = [
                { str: "Email:", transform: [1, 0, 0, 1, 50, 700] },
                { str: "jane@example.com", transform: [1, 0, 0, 1, 100, 700] },
                { str: "| Phone:", transform: [1, 0, 0, 1, 220, 700] },
                { str: "+123456789", transform: [1, 0, 0, 1, 280, 700] },
            ];

            const text = buildPageText(items);
            expect(text).toBe("Email: jane@example.com | Phone: +123456789");
        });

        it("handles empty and whitespace-only text items gracefully", () => {
            const items = [
                { str: " ", transform: [1, 0, 0, 1, 50, 700] },
                { str: "", transform: [1, 0, 0, 1, 50, 690] },
                { str: "Valid Content", transform: [1, 0, 0, 1, 50, 680] },
            ];

            const text = buildPageText(items);
            expect(text).toBe("Valid Content");
        });
    });

    describe("detectColumns", () => {
        it("identifies standard single-column layout as false", () => {
            const singleColumn = [
                { str: "John Smith", transform: [1, 0, 0, 1, 50, 700] },
                { str: "Summary of Experience", transform: [1, 0, 0, 1, 50, 680] },
                {
                    str: "Software Developer with 5 years experience",
                    transform: [1, 0, 0, 1, 50, 660],
                },
                { str: "Education: BS Computer Science", transform: [1, 0, 0, 1, 50, 640] },
            ];

            expect(detectColumns(singleColumn)).toBe(false);
        });

        it("detects multi-column layout with large horizontal gap", () => {
            const twoColumns = [
                // Left sidebar
                { str: "Skills", transform: [1, 0, 0, 1, 50, 700] },
                // Right main area (x = 300, gap is 250 > 100)
                { str: "Work Experience", transform: [1, 0, 0, 1, 300, 700] },
                // Left item 2
                { str: "React, Node.js", transform: [1, 0, 0, 1, 50, 680] },
                // Right item 2
                { str: "Senior Full Stack Engineer at Acme", transform: [1, 0, 0, 1, 300, 680] },
            ];

            expect(detectColumns(twoColumns)).toBe(true);
        });

        it("returns false for documents with fewer than 4 items", () => {
            const sparseItems = [
                { str: "Hello", transform: [1, 0, 0, 1, 50, 700] },
                { str: "World", transform: [1, 0, 0, 1, 300, 700] },
            ];

            expect(detectColumns(sparseItems)).toBe(false);
        });

        it("handles tabular rows with moderate spacing without false positives", () => {
            const tableRow = [
                { str: "Date", transform: [1, 0, 0, 1, 50, 700] },
                { str: "Company", transform: [1, 0, 0, 1, 100, 700] },
                { str: "Role", transform: [1, 0, 0, 1, 150, 700] },
                { str: "City", transform: [1, 0, 0, 1, 200, 700] },
            ];

            // Gaps between adjacent columns are 50 (<= 100)
            expect(detectColumns(tableRow)).toBe(false);
        });
    });
});
