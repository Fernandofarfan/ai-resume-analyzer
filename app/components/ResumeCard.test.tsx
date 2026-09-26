// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ResumeCard from "./ResumeCard";
import { useAppStore } from "~/lib/store";
import { useI18nStore } from "~/lib/i18n";
import type { ResumeHeader } from "~/domain/resume";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

let observerCallback: ObserverCallback | null = null;

class TestIntersectionObserver {
    root = null;
    rootMargin = "";
    thresholds: number[] = [];
    constructor(callback: ObserverCallback) {
        observerCallback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {
        observerCallback = null;
    }
    takeRecords() {
        return [];
    }
}

const read = vi.fn(async (_path: string) => new Blob(["image"], { type: "image/jpeg" }));

const header: ResumeHeader = {
    id: "resume-1",
    resumePath: "local://resumes/resume-1.pdf",
    imagePath: "local://resumes/resume-1.jpg",
    companyName: "Acme Corp",
    jobTitle: "Staff Engineer",
    overallScore: 91,
};

describe("ResumeCard", () => {
    beforeAll(() => {
        const holder = globalThis as { IntersectionObserver?: unknown };
        holder.IntersectionObserver = TestIntersectionObserver;
        // Always override: jsdom >= 30 ships a native createObjectURL that throws
        // on Node's Blob (`_bytes` is undefined) instead of returning a blob URL.
        Object.defineProperty(URL, "createObjectURL", {
            value: () => "blob:resume-preview",
            configurable: true,
            writable: true,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            value: () => {},
            configurable: true,
            writable: true,
        });
    });

    beforeEach(() => {
        observerCallback = null;
        read.mockClear();
        useAppStore.setState({
            fs: {
                read,
                upload: vi.fn(async () => undefined),
                delete: vi.fn(async () => undefined),
            },
        });
    });

    afterEach(() => {
        (URL as { createObjectURL: (blob: Blob) => string }).createObjectURL = vi.fn(
            () => "blob:resume-preview",
        );
    });

    it("defers reading the thumbnail until the card nears the viewport", async () => {
        render(
            <MemoryRouter>
                <ResumeCard resume={header} />
            </MemoryRouter>,
        );

        expect(read).not.toHaveBeenCalled();

        await act(async () => {
            observerCallback?.([{ isIntersecting: true }]);
        });

        expect(read).toHaveBeenCalledWith("local://resumes/resume-1.jpg");
        expect(await screen.findByRole("img")).toBeInTheDocument();
    });

    it("renders the job title, company and score", () => {
        render(
            <MemoryRouter>
                <ResumeCard resume={header} />
            </MemoryRouter>,
        );

        expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
        expect(screen.getByText("Acme Corp")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /Acme Corp Staff Engineer - ATS 91%/ }),
        ).toBeInTheDocument();
    });

    it("reports deletions with the resume id", () => {
        const onDelete = vi.fn();
        const { t } = useI18nStore.getState();

        render(
            <MemoryRouter>
                <ResumeCard resume={header} onDelete={onDelete} />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole("button", { name: t.resume.deleteResume }));
        expect(onDelete).toHaveBeenCalledWith("resume-1");
    });
});
