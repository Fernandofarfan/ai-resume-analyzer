// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Accordion, AccordionContent, AccordionHeader, AccordionItem } from "./Accordion";

const buildAccordion = (options?: { defaultOpen?: string; allowMultiple?: boolean }) => (
    <Accordion defaultOpen={options?.defaultOpen} allowMultiple={options?.allowMultiple}>
        <AccordionItem id="one">
            <AccordionHeader itemId="one">Section One</AccordionHeader>
            <AccordionContent itemId="one">Body one</AccordionContent>
        </AccordionItem>
        <AccordionItem id="two">
            <AccordionHeader itemId="two">Section Two</AccordionHeader>
            <AccordionContent itemId="two">Body two</AccordionContent>
        </AccordionItem>
    </Accordion>
);

describe("Accordion", () => {
    it("starts closed and toggles the section on header click", () => {
        render(buildAccordion());

        const header = screen.getByRole("button", { name: "Section One" });
        expect(header).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByText("Body one")).not.toBeVisible();

        fireEvent.click(header);
        expect(header).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("Body one")).toBeVisible();

        fireEvent.click(header);
        expect(header).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByText("Body one")).not.toBeVisible();
    });

    it("honours defaultOpen", () => {
        render(buildAccordion({ defaultOpen: "two" }));
        expect(screen.getByRole("button", { name: "Section Two" })).toHaveAttribute(
            "aria-expanded",
            "true",
        );
        expect(screen.getByText("Body two")).toBeVisible();
        expect(screen.getByText("Body one")).not.toBeVisible();
    });

    it("links header and region through aria-controls and aria-labelledby", () => {
        render(buildAccordion());
        const header = screen.getByRole("button", { name: "Section One" });
        const contentId = header.getAttribute("aria-controls");
        expect(contentId).toBeTruthy();

        const region = document.getElementById(contentId || "");
        expect(region).toHaveAttribute("role", "region");
        expect(region).toHaveAttribute("aria-labelledby", header.id);
    });

    it("keeps only one section open unless allowMultiple is set", () => {
        render(buildAccordion());
        fireEvent.click(screen.getByRole("button", { name: "Section One" }));
        fireEvent.click(screen.getByRole("button", { name: "Section Two" }));

        expect(screen.getByRole("button", { name: "Section One" })).toHaveAttribute(
            "aria-expanded",
            "false",
        );
        expect(screen.getByRole("button", { name: "Section Two" })).toHaveAttribute(
            "aria-expanded",
            "true",
        );
    });

    it("opens several sections at once when allowMultiple", () => {
        render(buildAccordion({ allowMultiple: true }));
        fireEvent.click(screen.getByRole("button", { name: "Section One" }));
        fireEvent.click(screen.getByRole("button", { name: "Section Two" }));

        expect(screen.getByRole("button", { name: "Section One" })).toHaveAttribute(
            "aria-expanded",
            "true",
        );
        expect(screen.getByRole("button", { name: "Section Two" })).toHaveAttribute(
            "aria-expanded",
            "true",
        );
    });
});
