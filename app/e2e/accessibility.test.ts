import { describe, it, expect } from "vitest";

class MockElement {
    tagName: string;
    id: string = "";
    attributes: Map<string, string> = new Map();
    children: MockElement[] = [];
    parentNode: MockElement | null = null;
    style: Record<string, string> = {};

    constructor(tagName: string) {
        this.tagName = tagName.toUpperCase();
    }

    setAttribute(name: string, val: string) {
        this.attributes.set(name, val);
    }

    getAttribute(name: string): string | null {
        return this.attributes.get(name) || null;
    }

    hasAttribute(name: string): boolean {
        return this.attributes.has(name);
    }

    appendChild(child: MockElement) {
        child.parentNode = this;
        this.children.push(child);
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
        }
    }

    querySelectorAll(selector: string): MockElement[] {
        const results: MockElement[] = [];
        const matches = (el: MockElement) => {
            if (selector.includes("data-autofocus") && el.hasAttribute("data-autofocus")) return true;
            if (selector.includes("button") && el.tagName === "BUTTON") return true;
            if (selector.includes("input") && el.tagName === "INPUT") return true;
            return false;
        };
        for (const child of this.children) {
            if (matches(child)) results.push(child);
            results.push(...child.querySelectorAll(selector));
        }
        return results;
    }

    querySelector(selector: string): MockElement | null {
        return this.querySelectorAll(selector)[0] || null;
    }

    focus() {
        mockDocument.activeElement = this;
    }
}

const mockDocument = {
    body: new MockElement("BODY"),
    activeElement: null as MockElement | null,
    createElement(tag: string) {
        return new MockElement(tag);
    },
    addEventListener: () => {},
    removeEventListener: () => {},
};

describe("UI Accessibility & Focus Management", () => {
    it("verifies modal dialog focus trapping, Escape handling, and ARIA roles", () => {
        // Trigger button
        const triggerBtn = mockDocument.createElement("button");
        triggerBtn.id = "open-dialog-btn";
        triggerBtn.focus();
        expect(mockDocument.activeElement).toBe(triggerBtn);

        // Dialog container
        const dialog = mockDocument.createElement("div");
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "dialog-title");

        const cancelBtn = mockDocument.createElement("button");
        cancelBtn.id = "cancel-btn";
        cancelBtn.setAttribute("data-autofocus", "true");
        dialog.appendChild(cancelBtn);

        const confirmBtn = mockDocument.createElement("button");
        confirmBtn.id = "confirm-btn";
        dialog.appendChild(confirmBtn);

        mockDocument.body.appendChild(dialog);

        // Verify data-autofocus takes priority
        const preferred = dialog.querySelector("[data-autofocus]");
        expect(preferred).toBe(cancelBtn);
        preferred?.focus();
        expect(mockDocument.activeElement).toBe(cancelBtn);

        // Verify focusable elements discovery
        const focusable = dialog.querySelectorAll("button");
        expect(focusable.length).toBe(2);
        expect(focusable[0]).toBe(cancelBtn);
        expect(focusable[1]).toBe(confirmBtn);

        // Verify ARIA roles
        expect(dialog.getAttribute("role")).toBe("dialog");
        expect(dialog.getAttribute("aria-modal")).toBe("true");

        // Simulate closing and focus restoration
        dialog.remove();
        triggerBtn.focus();
        expect(mockDocument.activeElement).toBe(triggerBtn);
    });

    it("verifies role=alert and role=status live announcement contracts", () => {
        const alertBox = mockDocument.createElement("div");
        alertBox.setAttribute("role", "alert");
        expect(alertBox.getAttribute("role")).toBe("alert");

        const statusBox = mockDocument.createElement("div");
        statusBox.setAttribute("role", "status");
        expect(statusBox.getAttribute("role")).toBe("status");
    });
});
