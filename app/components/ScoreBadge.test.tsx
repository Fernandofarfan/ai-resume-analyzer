// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreBadge from "./ScoreBadge";
import { useI18nStore } from "~/lib/i18n";

describe("ScoreBadge", () => {
    const texts = () => useI18nStore.getState().t.resume;

    it("renders the positive label for high scores", () => {
        render(<ScoreBadge score={90} />);
        expect(screen.getByText(texts().atsSubGood)).toBeInTheDocument();
    });

    it("renders the average label for mid-range scores", () => {
        render(<ScoreBadge score={62} />);
        expect(screen.getByText(texts().atsSubStart)).toBeInTheDocument();
    });

    it("renders the improvement label for low scores", () => {
        render(<ScoreBadge score={20} />);
        expect(screen.getByText(texts().atsSubImprove)).toBeInTheDocument();
    });

    it("uses the boundary values of each band", () => {
        render(<ScoreBadge score={75} />);
        expect(screen.getByText(texts().atsSubGood)).toBeInTheDocument();
    });
});
