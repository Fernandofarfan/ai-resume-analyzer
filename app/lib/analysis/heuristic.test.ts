import { describe, it, expect } from "vitest";
import {
    containsKeyword,
    normalizeText,
    extractSignificantKeywords,
    generateResumeFeedback,
    extractProfileSignals,
    computeConfidence,
} from "./heuristic";

describe("normalizeText", () => {
    it("lowercases and strips accents", () => {
        expect(normalizeText("Desarrollé JavaScript")).toBe("desarrolle javascript");
    });
});

describe("containsKeyword (whole-word)", () => {
    it("does not match a keyword that is a substring of another word", () => {
        expect(containsKeyword("javascript and typescript", "java")).toBe(false);
        expect(containsKeyword("reaction time", "react")).toBe(false);
    });

    it("matches a standalone keyword", () => {
        expect(containsKeyword("I use react daily", "react")).toBe(true);
    });

    it("ignores accents and case", () => {
        expect(containsKeyword("Certificación AWS", "certificacion")).toBe(true);
    });

    it("matches singular/plural variants", () => {
        expect(containsKeyword("certificación", "certificaciones")).toBe(true);
    });
});

describe("extractSignificantKeywords", () => {
    it("returns keywords ordered by relevance", () => {
        const kws = extractSignificantKeywords("react react react javascript typescript node");
        expect(kws.length).toBeGreaterThan(0);
    });

    it("returns an empty array for empty input", () => {
        expect(extractSignificantKeywords("")).toEqual([]);
    });
});

describe("generateResumeFeedback", () => {
    it("returns null matchScore when no job description/title is provided", () => {
        const fb = generateResumeFeedback(
            { rawText: "Experiencia laboral en desarrollo de software" },
            "es",
        );
        expect(fb.keywords?.matchScore).toBeNull();
    });

    it("computes a numeric matchScore when job info is provided", () => {
        const fb = generateResumeFeedback(
            {
                rawText: "react javascript",
                jobTitle: "Frontend Developer",
                jobDescription: "react javascript css",
            },
            "en",
        );
        expect(typeof fb.keywords?.matchScore).toBe("number");
    });

    it("uses placeholders instead of fabricated metrics", () => {
        const fb = generateResumeFeedback({ rawText: "x", jobTitle: "Dev" }, "es");
        for (const rewrite of fb.bulletRewrites ?? []) {
            expect(rewrite.suggestedRewrite).not.toMatch(/\b(28|35)%\b/);
            expect(rewrite.suggestedRewrite).toContain("[X%]");
        }
    });

    it("marks the result as heuristic", () => {
        const fb = generateResumeFeedback({ rawText: "x" }, "es");
        expect(fb.source).toBe("heuristic");
    });

    it("returns a confidence level", () => {
        const fb = generateResumeFeedback(
            {
                rawText: "react javascript typescript node css html",
                jobTitle: "Dev",
                jobDescription: "react javascript css",
            },
            "en",
        );
        expect(["low", "medium", "high"]).toContain(fb.confidence);
    });
});

describe("containsKeyword (synonyms/acronyms)", () => {
    it("treats node, node.js and nodejs as equivalent", () => {
        expect(containsKeyword("Node.js developer", "nodejs")).toBe(true);
        expect(containsKeyword("nodejs developer", "node.js")).toBe(true);
        expect(containsKeyword("I use Node", "nodejs")).toBe(true);
    });

    it("handles -ies plurals", () => {
        expect(containsKeyword("frontend technologies", "technology")).toBe(true);
    });

    it("does not equate react with react native", () => {
        expect(containsKeyword("I use react", "react native")).toBe(false);
    });

    it("maps skill aliases to canonical terms", () => {
        expect(containsKeyword("experienced with AWS Lambda", "lambda")).toBe(true);
        expect(containsKeyword("ecmascript", "javascript")).toBe(true);
    });
});

describe("extractProfileSignals", () => {
    it("extracts years of experience", () => {
        expect(extractProfileSignals("5 años de experiencia en desarrollo").yearsExperience).toBe(
            5,
        );
        expect(extractProfileSignals("3+ years of experience").yearsExperience).toBe(3);
    });

    it("returns null when no years detected", () => {
        expect(extractProfileSignals("Software engineer").yearsExperience).toBeNull();
    });

    it("counts quantified achievements", () => {
        const signals = extractProfileSignals("reduced costs by 20% and led 3 projects");
        expect(signals.quantifiedAchievements).toBeGreaterThan(0);
    });

    it("detects varied metric formats", () => {
        const signals = extractProfileSignals(
            "boosted 1.5M users, +35% growth, 3x faster, €50k savings, USD 100,000 revenue",
        );
        expect(signals.quantifiedAchievements).toBeGreaterThanOrEqual(3);
    });
});

describe("computeConfidence", () => {
    it("returns low when there is no resume text", () => {
        expect(
            computeConfidence({
                wordCount: 0,
                targetKeywordCount: 5,
                hasJobDescription: true,
                metricCount: 2,
                hasResumeText: false,
            }),
        ).toBe("low");
    });

    it("returns high when there is plenty of signal", () => {
        expect(
            computeConfidence({
                wordCount: 200,
                targetKeywordCount: 5,
                hasJobDescription: true,
                metricCount: 3,
                hasResumeText: true,
            }),
        ).toBe("high");
    });
});

describe("evidence-based score calibration", () => {
    it("caps score at 20 when document is almost empty or very short", () => {
        const fb = generateResumeFeedback({ rawText: "Juan Perez Desarrollador" }, "es");
        expect(fb.overallScore).toBeLessThanOrEqual(20);
        expect(fb.confidence).toBe("low");
    });

    it("awards high score only when extensive sections, metrics, and keywords are present", () => {
        const fullResume = `
            Juan Perez - Contacto: juan@email.com, linkedin.com/in/juanperez
            Perfil Profesional:
            Ingeniero de software con más de 8 años de experiencia en desarrollo web y arquitectura de sistemas.

            Experiencia Laboral:
            - Tech Corp: Lideré el desarrollo de microservicios en React, TypeScript y Node.js.
            - Optimicé los tiempos de respuesta en un 40% para 1.5M usuarios activos.
            - Reduje los costos de infraestructura en €30k implementando Docker y Kubernetes.
            - Diseñé pipelines CI/CD automatizados logrando 99.9% de disponibilidad.

            Educación:
            - Licenciatura en Ciencias de la Computación, Universidad Nacional.

            Habilidades Técnicas:
            - React, TypeScript, Node.js, Docker, Kubernetes, AWS, SQL, GraphQL.
        `;
        const fb = generateResumeFeedback(
            {
                rawText: fullResume,
                jobTitle: "Senior Full Stack Engineer",
                jobDescription:
                    "Buscamos Senior Full Stack Engineer con experiencia en React, TypeScript, Node.js, Docker y Kubernetes.",
            },
            "es",
        );

        expect(fb.overallScore).toBeGreaterThanOrEqual(75);
        expect(fb.confidence).toBe("high");
    });
});
