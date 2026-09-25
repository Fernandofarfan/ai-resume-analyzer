// Deterministic, local ATS & keyword analysis engine with bilingual support.
// This module contains no I/O or side effects and can be unit-tested in
// isolation.

import type { Feedback, BulletRewrite, Confidence } from "~/domain/feedback";

// Numeric metric extraction covering common formats: percentages (+35%, 20–30%),
// scaled values (1.5M, 50k, 3x), currencies (€50k, USD 100,000) and
// unit-qualified counts (100 clientes, 5 años).
const METRIC_REGEX = /(?:\+?\d+(?:[.,]\d+)?\s*%|\d+(?:[.,]\d+)?\s*(?:k|m)\b|(?:usd|eur|€|\$)\s*\d+(?:[.,]\d+)*|\d+\s*(?:años|anos|years|usuarios|users|clientes|clients|ventas|sales|horas|hours|proyectos|projects)\b|\d+\s*x\b|\d+\s*[-–]\s*\d+\s*%)/gi;

// ---------------------------------------------------------------------------
// Text normalization & keyword utilities
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
    "para", "como", "este", "esta", "estos", "estas", "sobre", "entre", "hacia", "hasta", "desde",
    "with", "from", "that", "this", "these", "those", "have", "been", "will", "would", "should",
    "could", "about", "above", "across", "after", "again", "against", "along", "also", "your",
    "their", "there", "where", "which", "while", "when", "then", "them", "some", "such", "than",
    "each", "every", "more", "most", "other", "into", "only", "well", "must", "work", "team",
    "anos", "años", "years", "experiencia", "experience", "puesto", "role", "position", "ability",
    "responsable", "responsibilities", "requisitos", "requirements", "conocimientos", "habilidades",
    "profesional", "professional", "trabajo", "job", "empresa", "company", "candidato", "candidate",
    "curriculum", "currículum", "resume", "perfil", "profile", "titulo", "título", "title",
    "descripcion", "descripción", "description", "laboral", "empleo", "oferta", "vacancy",
    "and", "the", "you", "our", "for", "are", "its", "can", "all", "not", "one", "two",
    "per", "los", "las", "del", "una", "un", "con", "por", "para", "sin", "más", "mas",
]);

// Well-known technical terms get a relevance boost during keyword ranking so
// that generic frequent words don't dominate the extraction.
const TECH_TERMS = new Set([
    "javascript", "typescript", "python", "java", "kotlin", "swift", "go", "golang", "rust",
    "php", "ruby", "c++", "c#", "c", "sql", "nosql", "html", "css", "sass", "scss",
    "react", "angular", "vue", "svelte", "next.js", "nextjs", "node", "node.js", "nodejs",
    "express", "django", "flask", "spring", "rails", "laravel", "graphql", "rest", "restful",
    "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "terraform", "ci/cd", "jenkins",
    "git", "github", "gitlab", "redis", "postgresql", "postgres", "mysql", "mongodb",
    "elasticsearch", "kafka", "rabbitmq", "spark", "hadoop", "airflow", "dbt", "tableau",
    "powerbi", "excel", "figma", "linux", "unix", "bash", "shell", "scrum", "agile", "jira",
    "machine learning", "deep learning", "nlp", "computer vision", "data science", "pandas",
    "numpy", "tensorflow", "pytorch", "sklearn", "scikit-learn", "llm", "openai", "langchain",
]);

// Normalized skill catalog: every alias maps to a single canonical term so that
// "node", "node.js" and "nodejs" (and similar variants) are treated as the same
// skill. Categories are kept for future grouping/UX.
type SkillCategory =
    | "programming-language"
    | "framework"
    | "library"
    | "database"
    | "cloud"
    | "devops"
    | "tool"
    | "platform"
    | "concept";

interface SkillEntry {
    canonical: string;
    aliases: string[];
    category: SkillCategory;
}

const SKILL_CATALOG: SkillEntry[] = [
    { canonical: "javascript", aliases: ["js", "ecmascript"], category: "programming-language" },
    { canonical: "typescript", aliases: ["ts"], category: "programming-language" },
    { canonical: "node.js", aliases: ["node", "nodejs"], category: "platform" },
    { canonical: "react", aliases: ["reactjs", "react.js"], category: "library" },
    { canonical: "vue", aliases: ["vuejs", "vue.js"], category: "framework" },
    { canonical: "next.js", aliases: ["nextjs"], category: "framework" },
    { canonical: "csharp", aliases: ["c#"], category: "programming-language" },
    { canonical: "cpp", aliases: ["c++"], category: "programming-language" },
    { canonical: "dotnet", aliases: [".net"], category: "framework" },
    { canonical: "kubernetes", aliases: ["k8s"], category: "devops" },
    { canonical: "go", aliases: ["golang"], category: "programming-language" },
    { canonical: "postgresql", aliases: ["postgres"], category: "database" },
    { canonical: "machine learning", aliases: ["ml"], category: "concept" },
    { canonical: "aws lambda", aliases: ["lambda"], category: "cloud" },
    { canonical: "amazon web services", aliases: ["aws"], category: "cloud" },
    { canonical: "microsoft azure", aliases: ["azure"], category: "cloud" },
    { canonical: "google cloud", aliases: ["gcp"], category: "cloud" },
    { canonical: "ci/cd", aliases: ["ci", "cd"], category: "devops" },
    { canonical: "artificial intelligence", aliases: ["ai"], category: "concept" },
];

const SKILL_ALIASES: Record<string, string> = {};
for (const entry of SKILL_CATALOG) {
    SKILL_ALIASES[entry.canonical] = entry.canonical;
    for (const alias of entry.aliases) {
        SKILL_ALIASES[alias] = entry.canonical;
    }
}

export const normalizeText = (text: string): string =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const canonicalize = (token: string): string => {
    const lower = token.toLowerCase().trim();
    if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];
    const cleaned = lower.replace(/\.(js|jsx|ts|tsx|net)$/i, "");
    if (!cleaned) return lower;
    return SKILL_ALIASES[cleaned] ?? cleaned;
};

const pluralVariants = (token: string): string[] => {
    const variants = new Set<string>([token]);
    if (token.length > 4) {
        if (token.endsWith("ies")) {
            variants.add(token.slice(0, -3) + "y");
        } else if (token.endsWith("es")) {
            variants.add(token.slice(0, -2));
        } else if (token.endsWith("s") && !token.endsWith("ss")) {
            variants.add(token.slice(0, -1));
        }
    } else if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
        variants.add(token.slice(0, -1));
    }
    return [...variants];
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const containsKeyword = (text: string, keyword: string): boolean => {
    const haystack = normalizeText(text);
    const rawToken = normalizeText(keyword).trim();
    if (!rawToken) return false;

    const canonicalToken = canonicalize(rawToken);
    const targets = pluralVariants(canonicalToken);

    // Whole-word regex on the normalized haystack handles multi-word phrases
    // and punctuation-separated terms (e.g. "node.js", "c++").
    const candidates = new Set<string>([rawToken, ...targets]);
    for (const candidate of candidates) {
        if (!candidate) continue;
        const escaped = escapeRegExp(candidate);
        if (new RegExp(`(^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(haystack)) {
            return true;
        }
    }

    // Token-canonical matching handles synonym/acronym equivalence such as
    // "node" === "nodejs" === "node.js".
    const haySet = new Set<string>();
    for (const raw of tokenize(text)) {
        const canonical = canonicalize(raw);
        haySet.add(canonical);
        for (const variant of pluralVariants(canonical)) haySet.add(variant);
    }
    return targets.some((target) => haySet.has(target));
};

const tokenize = (text: string): string[] =>
    normalizeText(text)
        .replace(/[^a-z0-9+#./-]/gi, " ")
        .split(/\s+/)
        .filter((token) => token.length > 1 && !STOPWORDS.has(token) && !/^\d+$/.test(token));

// Extract significant domain/tech keywords, including frequent bigrams, ranked
// by a mix of frequency and technical relevance.
export const extractSignificantKeywords = (text: string, limit = 15): string[] => {
    if (!text) return [];

    const tokens = tokenize(text);
    if (tokens.length === 0) return [];

    const counts: Record<string, number> = {};
    tokens.forEach((token) => {
        counts[token] = (counts[token] || 0) + 1;
    });

    // Bigrams of adjacent non-stopword tokens capture multi-word phrases.
    const bigramCounts: Record<string, number> = {};
    for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        if (TECH_TERMS.has(bigram)) {
            bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
        }
    }

    const score = (term: string, count: number): number => {
        let value = count;
        if (TECH_TERMS.has(term)) value += 2;
        // Slight preference for multi-word technical terms.
        if (term.includes(" ")) value += 1;
        return value;
    };

    const ranked = [
        ...Object.keys(counts).map((term) => ({ term, score: score(term, counts[term]) })),
        ...Object.keys(bigramCounts).map((term) => ({ term, score: score(term, bigramCounts[term]) })),
    ];

    return ranked
        .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
        .slice(0, limit)
        .map((entry) => entry.term);
};

// ---------------------------------------------------------------------------
// Feedback engine
// ---------------------------------------------------------------------------

interface ResumeInput {
    rawText?: string;
    jobTitle?: string;
    jobDescription?: string;
}

// Estimate how much signal the analysis is based on, so the UI can communicate
// when a score rests on sparse data.
export const computeConfidence = (signals: {
    wordCount: number;
    targetKeywordCount: number;
    hasJobDescription: boolean;
    metricCount: number;
    hasResumeText: boolean;
}): Confidence => {
    if (!signals.hasResumeText) return "low";
    let score = 0;
    if (signals.wordCount >= 150) score++;
    if (signals.targetKeywordCount >= 3) score++;
    if (signals.hasJobDescription) score++;
    if (signals.metricCount >= 2) score++;
    if (score >= 3) return "high";
    if (score === 2) return "medium";
    return "low";
};

export interface ProfileSignals {
    yearsExperience: number | null;
    quantifiedAchievements: number;
}

// Extract coarse, non-fabricated profile signals (years of experience and
// number of quantified achievements) for use in the cover letter.
export const extractProfileSignals = (rawText: string): ProfileSignals => {
    const text = rawText || "";
    let yearsExperience: number | null = null;
    const direct = text.match(/(\d{1,2})\s*\+?\s*(?:años|anos|years?)/i);
    if (direct) {
        const n = parseInt(direct[1], 10);
        if (!Number.isNaN(n) && n > 0 && n <= 60) yearsExperience = n;
    }
    const quantifiedAchievements = (text.match(METRIC_REGEX) || []).length;
    return { yearsExperience, quantifiedAchievements };
};

export const generateResumeFeedback = (
    resumeData: ResumeInput,
    language: "es" | "en" = "es"
): Feedback => {
    const isSpanish = language === "es";

    let jobTitle = resumeData.jobTitle?.trim() || "";
    if (!jobTitle || jobTitle.includes("No especificado") || jobTitle.includes("Not specified")) {
        jobTitle = isSpanish ? "Puesto Profesional" : "Professional Role";
    }

    const jobDesc = resumeData.jobDescription?.trim() || "";
    const resumeText = resumeData.rawText?.trim() || "";

    const textLower = resumeText.toLowerCase();
    const wordCount = resumeText ? resumeText.split(/\s+/).filter(Boolean).length : 0;

    // --- Keyword Gap Analysis (whole-word, accent/plural normalized) ---
    const hasTarget = (jobDesc || (resumeData.jobTitle?.trim() || "")).length > 0;
    const targetKeywords = hasTarget
        ? extractSignificantKeywords(`${jobDesc ? jobDesc : jobTitle}`)
        : [];

    const matchingKeywords: string[] = [];
    const missingKeywords: string[] = [];

    targetKeywords.forEach((kw) => {
        if (containsKeyword(resumeText, kw)) {
            matchingKeywords.push(kw);
        } else {
            missingKeywords.push(kw);
        }
    });

    // null => not evaluable (no job description/title to compare against).
    const keywordMatchScore: number | null = targetKeywords.length > 0
        ? Math.round((matchingKeywords.length / targetKeywords.length) * 100)
        : null;

    // --- Evidence-Based Heuristic Scoring ---
    const isVeryShort = wordCount < 40;

    // 1. Structure & Sections
    const hasContact = /@|linkedin|github|telefono|teléfono|phone|email|correo|\+?\d{8,}/i.test(resumeText);
    const hasExperience = /experiencia|experience|trayectoria|work history|historial laboral|empleo/i.test(textLower);
    const hasEducation = /educaci[oó]n|education|universidad|university|licenciatura|grado|bachelor|master|m[aá]ster/i.test(textLower);
    const hasSkills = /habilidades|skills|aptitudes|conocimientos|technologies|tecnolog[ií]as|herramientas|stack/i.test(textLower);
    const hasSummary = /resumen|summary|perfil|profile|sobre m[ií]|about me|objetivo/i.test(textLower);

    let structureScore: number;
    if (isVeryShort) {
        structureScore = 10 + (hasContact ? 5 : 0) + (hasExperience ? 5 : 0);
    } else {
        structureScore = 20;
        if (hasContact) structureScore += 15;
        if (hasExperience) structureScore += 25;
        if (hasEducation) structureScore += 15;
        if (hasSkills) structureScore += 15;
        if (hasSummary) structureScore += 10;
        // Heavy penalty if core sections are completely absent
        if (!hasExperience && !hasEducation) structureScore -= 15;
    }
    structureScore = Math.min(98, Math.max(10, structureScore));

    // 2. Content & Metrics
    const metricMatches = resumeText.match(METRIC_REGEX) || [];
    const metricCount = metricMatches.length;

    let contentScore: number;
    if (isVeryShort) {
        contentScore = Math.max(5, Math.min(20, Math.round(wordCount * 0.4)));
    } else {
        contentScore = 25;
        if (wordCount >= 300) contentScore += 25;
        else if (wordCount >= 150) contentScore += 15;
        else if (wordCount >= 60) contentScore += 8;

        if (metricCount >= 4) contentScore += 35;
        else if (metricCount >= 2) contentScore += 20;
        else if (metricCount >= 1) contentScore += 10;
    }
    contentScore = Math.min(96, Math.max(10, contentScore));

    // 3. Tone & Action Verbs (bilingual regex ensures fairness regardless of UI language vs document language)
    const actionVerbsBilingual = /lider[eé]|desarroll[eé]|dise[ñn][eé]|implement[eé]|optimiz[eé]|coordin[eé]|cre[eé]|aument[eé]|reduj[eé]|gestion[eé]|arquitectur|led|developed|designed|implemented|optimized|coordinated|created|increased|reduced|managed|engineered|built|architected|spearheaded/gi;
    const actionVerbCount = (resumeText.match(actionVerbsBilingual) || []).length;

    const passivePhrases = /responsable de|ayud[eé] a|particip[eé] en|assisted with|helped to|responsible for/gi;
    const passiveCount = (resumeText.match(passivePhrases) || []).length;

    let toneScore: number;
    if (isVeryShort) {
        toneScore = 15;
    } else {
        toneScore = 35;
        if (actionVerbCount >= 4) toneScore += 35;
        else if (actionVerbCount >= 2) toneScore += 20;
        else if (actionVerbCount >= 1) toneScore += 10;
        if (passiveCount > 0) toneScore -= Math.min(15, passiveCount * 5);
    }
    toneScore = Math.min(97, Math.max(15, toneScore));

    // 4. Skills Score
    let skillsScore: number;
    if (isVeryShort) {
        skillsScore = 15;
    } else if (keywordMatchScore !== null) {
        skillsScore = Math.round((keywordMatchScore * 0.7) + (hasSkills ? 30 : 0));
    } else {
        // Without target job posting, reflect detected skill presence honestly without false match inflation
        skillsScore = hasSkills ? 55 : 30;
    }
    skillsScore = Math.min(98, Math.max(15, skillsScore));

    // ATS Overall Score
    const atsScore = Math.round((structureScore * 0.28) + (skillsScore * 0.32) + (contentScore * 0.25) + (toneScore * 0.15));
    let overall = Math.round((atsScore * 0.35) + (contentScore * 0.25) + (structureScore * 0.2) + (toneScore * 0.1) + (skillsScore * 0.1));
    if (isVeryShort) {
        overall = Math.min(20, overall);
    }

    // Bullet rewrites using the Google XYZ formula. Metrics are placeholders so
    // the user supplies their own real numbers instead of fabricated figures.
    const bulletRewrites: BulletRewrite[] = [
        {
            originalTip: isSpanish ? "Cuantificar logros con métricas" : "Quantify achievements with metrics",
            suggestedRewrite: isSpanish
                ? `Optimicé [proceso/área] para ${jobTitle}, logrando una mejora del [X%] en [métrica] mediante [acción/tecnología].`
                : `Improved [process/area] for ${jobTitle}, achieving a [X%] gain in [metric] by [action/technology].`,
            reasoning: isSpanish
                ? "Aplica la fórmula Google: Logro específico + Impacto numérico + Método de implementación. Sustituye [X%] y [métrica] por tus datos reales."
                : "Applies Google XYZ format: Specific achievement + Quantified metric + Mechanism. Replace [X%] and [metric] with your own numbers."
        },
        {
            originalTip: isSpanish ? "Evitar lenguaje pasivo" : "Eliminate passive phrasing",
            suggestedRewrite: isSpanish
                ? `Lideré [proyecto/iniciativa], reduciendo [métrica] en un [X%].`
                : `Spearheaded [project/initiative], reducing [metric] by [X%].`,
            reasoning: isSpanish
                ? "Reemplaza 'responsable de' por un verbo de acción directo ('Lideré') y asocia un resultado medible real."
                : "Replaces passive duty descriptions with a high-impact proactive verb tied to a real result."
        }
    ];

    const base: Feedback = {
        overallScore: overall,
        source: "heuristic",
        confidence: computeConfidence({
            wordCount,
            targetKeywordCount: targetKeywords.length,
            hasJobDescription: !!jobDesc,
            metricCount,
            hasResumeText: !!resumeText,
        }),
        keywords: {
            matchScore: keywordMatchScore,
            matching: matchingKeywords,
            missing: missingKeywords,
        },
        bulletRewrites,
        ATS: {
            score: atsScore,
            tips: [],
        },
        toneAndStyle: {
            score: toneScore,
            tips: [],
        },
        content: {
            score: contentScore,
            tips: [],
        },
        structure: {
            score: structureScore,
            tips: [],
        },
        skills: {
            score: skillsScore,
            tips: [],
        },
    };

    base.ATS.tips = [
        hasExperience && hasEducation
            ? { type: "good", tip: isSpanish ? "Encabezados estándar y estructura compatible con los analizadores ATS más utilizados." : "Standard section headers ensuring high parseability across ATS platforms." }
            : { type: "improve", tip: isSpanish ? "Asegúrate de incluir secciones claramente tituladas: 'Experiencia Laboral', 'Educación' y 'Habilidades'." : "Ensure clearly labeled sections: 'Work Experience', 'Education', and 'Skills'." },
        matchingKeywords.length >= 3
            ? { type: "good", tip: isSpanish ? `Buena densidad de palabras clave alineadas con el puesto de ${jobTitle}.` : `Solid keyword alignment matching the role of ${jobTitle}.` }
            : { type: "improve", tip: isSpanish ? `Incorpora más términos y requisitos específicos del rol de ${jobTitle} a lo largo de tu CV.` : `Incorporate more target keywords and domain skills corresponding to ${jobTitle}.` },
        metricCount >= 2
            ? { type: "good", tip: isSpanish ? "Presencia de logros cuantificados mediante métricas y cifras concretas." : "Strong presence of quantified achievements and measurable metrics." }
            : { type: "improve", tip: isSpanish ? "Cuantifica tus responsabilidades con resultados medibles (% de eficiencia, tiempo o costos ahorrados)." : "Quantify your achievements with concrete metrics (% improvements, time/cost savings)." },
        hasContact
            ? { type: "good", tip: isSpanish ? "Datos de contacto identificables para los reclutadores." : "Contact information easily identifiable by hiring managers and parsers." }
            : { type: "improve", tip: isSpanish ? "Verifica que tu correo electrónico, teléfono y enlace a LinkedIn sean fácilmente legibles." : "Make sure your email, phone number, and LinkedIn URL are prominent and clean." },
    ];

    base.toneAndStyle.tips = [
        actionVerbCount >= 2
            ? { type: "good", tip: isSpanish ? "Verbos de Acción Efectivos" : "Strong Action Verbs", explanation: isSpanish ? "Tus viñetas utilizan verbos contundentes que transmiten proactividad y autonomía." : "Bullet points lead with powerful action verbs conveying autonomy and leadership." }
            : { type: "improve", tip: isSpanish ? "Utilizar Verbos de Acción Fuertes" : "Leverage Action Verbs", explanation: isSpanish ? "Comienza cada viñeta con verbos como 'Lideré', 'Desarrollé', 'Implementé' u 'Optimicé'." : "Start bullet points with definitive verbs like 'Spearheaded', 'Engineered', 'Orchestrated', or 'Optimized'." },
        passiveCount > 0
            ? { type: "improve", tip: isSpanish ? "Evitar Lenguaje Pasivo" : "Eliminate Passive Phrasing", explanation: isSpanish ? "Reemplaza fórmulas como 'Responsable de' o 'Ayudé a' por acciones directas y asertivas." : "Replace passive phrases like 'Responsible for' or 'Helped with' with active, direct contribution statements." }
            : { type: "good", tip: isSpanish ? "Tono Profesional y Directo" : "Assertive Tone", explanation: isSpanish ? "El lenguaje utilizado es asertivo y centrado en la ejecución." : "Resume maintains a direct, professional and achievement-oriented tone." },
    ];

    base.content.tips = [
        metricCount >= 2
            ? { type: "good", tip: isSpanish ? "Impacto Cuantificado" : "Quantified Impact", explanation: isSpanish ? "Respaldaste tus responsabilidades con métricas numéricas concretas." : "You backed up your responsibilities with tangible numbers and deliverables." }
            : { type: "improve", tip: isSpanish ? "Añadir Métricas y Resultados" : "Add Quantifiable Metrics", explanation: isSpanish ? "Asocia cada función principal a un indicador de éxito (ej. porcentaje de mejora, reducción de tiempos)." : "Connect each core responsibility to a tangible business or technical outcome." },
        wordCount >= 200
            ? { type: "good", tip: isSpanish ? "Profundidad de Contenido Adecuada" : "Optimal Detail Depth", explanation: isSpanish ? "El nivel de detalle describe con claridad tus responsabilidades profesionales." : "The depth of explanations effectively captures your scope of work." }
            : { type: "improve", tip: isSpanish ? "Ampliar Detalle de Experiencias" : "Expand Experience Details", explanation: isSpanish ? "Tu CV es breve. Explica con mayor detalle los proyectos y tecnologías que dominas." : "Your resume content is brief. Provide more details on technical projects and contributions." },
    ];

    base.structure.tips = [
        hasExperience && hasSkills
            ? { type: "good", tip: isSpanish ? "Organización Modular Clara" : "Clean Modular Layout", explanation: isSpanish ? "Las secciones principales están claramente diferenciadas para una lectura ágil." : "Clear separation between Experience, Education, and Technical Competencies." }
            : { type: "improve", tip: isSpanish ? "Completar Secciones Fundamentales" : "Organize Core Sections", explanation: isSpanish ? "Asegúrate de estructurar el CV con: Perfil, Experiencia Laboral, Educación y Habilidades." : "Ensure standard chronological sections: Summary, Experience, Education, and Skills." },
        { type: "good", tip: isSpanish ? "Estructura y Encabezados Legibles" : "Scannable Standard Headings", explanation: isSpanish ? "Las secciones detectadas facilitan la lectura inmediata y el escaneo automático." : "The detected headings provide immediate scannability and clear section boundaries." },
    ];

    base.skills.tips = [
        hasSkills
            ? { type: "good", tip: isSpanish ? "Sección de Habilidades Presente" : "Dedicated Skills Section", explanation: isSpanish ? "El documento incluye un apartado específico para tus competencias técnicas." : "Document has a clear area highlighting technical competencies." }
            : { type: "improve", tip: isSpanish ? "Crear Sección de Habilidades" : "Create Categorized Skills Section", explanation: isSpanish ? "Agrega un bloque dedicado a Habilidades Técnicas, Frameworks y Herramientas." : "Group skills into Core Languages, Frameworks, and Tools for faster recruiter evaluation." },
        matchingKeywords.length >= 3
            ? { type: "good", tip: isSpanish ? "Coincidencia con la Oferta" : "Job Match Alignment", explanation: isSpanish ? `Detectamos términos clave requeridos por la vacante (${matchingKeywords.slice(0, 4).join(", ")}).` : `Key keywords from the target job were found in your profile (${matchingKeywords.slice(0, 4).join(", ")}).` }
            : { type: "improve", tip: isSpanish ? "Optimizar Palabras Clave" : "Targeted Industry Keywords", explanation: missingKeywords.length > 0
                ? (isSpanish ? `Te recomendamos incorporar términos de la oferta como: ${missingKeywords.slice(0, 4).join(", ")}.` : `Consider integrating missing job requirements: ${missingKeywords.slice(0, 4).join(", ")}.`)
                : (isSpanish ? `Incluye certificaciones y términos tecnológicos estándar para el rol de ${jobTitle}.` : `Ensure specific industry certifications and tools for ${jobTitle} are prominently featured.`) },
    ];

    return base;
};

// Parses the serialized instruction prompt (used by the offline fallback path)
// back into structured data before running the engine.
export const analyzeResumeContent = (instructionMessage: string): Feedback => {
    const isSpanish = /IDIOMA ESPAÑOL|puesto objetivo|currículum/i.test(instructionMessage);

    let jobTitle = isSpanish ? "Puesto Profesional" : "Professional Role";
    const jobTitleMatch = instructionMessage.match(/(?:The job title is|El título del puesto objetivo es):\s*([^\n\r]*)/i);
    if (jobTitleMatch && jobTitleMatch[1]?.trim() && !jobTitleMatch[1].includes("No especificado") && !jobTitleMatch[1].includes("Not specified")) {
        jobTitle = jobTitleMatch[1].trim();
    }

    // Capture the full multi-line job description up to the next delimiter,
    // instead of only the first line.
    const jobDescMatch = instructionMessage.match(/(?:The job description is|La descripción de la oferta laboral es):\s*([\s\S]*?)(?=(?:--- |The extracted resume text|El contenido de texto extraído|$))/i);
    const jobDescription = jobDescMatch && jobDescMatch[1]?.trim() && !jobDescMatch[1].includes("No especificada") && !jobDescMatch[1].includes("Not specified")
        ? jobDescMatch[1].trim()
        : "";

    let rawText = "";
    const resumeTextMatch = instructionMessage.match(/(?:--- INICIO CONTENIDO CV ---|--- START RESUME CONTENT ---)([\s\S]*?)(?:--- FIN CONTENIDO CV ---|--- END RESUME CONTENT ---)/i);
    if (resumeTextMatch && resumeTextMatch[1]) {
        rawText = resumeTextMatch[1].trim();
    }

    return generateResumeFeedback({ rawText, jobTitle, jobDescription }, isSpanish ? "es" : "en");
};
