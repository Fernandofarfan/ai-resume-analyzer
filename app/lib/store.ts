import { create } from "zustand";

interface AppStore {
    isLoading: boolean;
    error: string | null;
    ready: boolean;
    auth: {
        user: AppUser | null;
        isAuthenticated: boolean;
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
        refreshUser: () => Promise<void>;
        checkAuthStatus: () => Promise<boolean>;
        getUser: () => AppUser | null;
    };
    fs: {
        write: (
            path: string,
            data: string | File | Blob
        ) => Promise<File | undefined>;
        read: (path: string) => Promise<Blob | undefined>;
        upload: (file: File[] | Blob[]) => Promise<FSItem | undefined>;
        delete: (path: string) => Promise<void>;
        readDir: (path: string) => Promise<FSItem[] | undefined>;
    };
    ai: {
        chat: (
            prompt: string | ChatMessage[]
        ) => Promise<AIResponse | undefined>;
        feedback: (
            path: string,
            message: string
        ) => Promise<AIResponse | undefined>;
        img2txt: (
            image: string | File | Blob
        ) => Promise<string | undefined>;
    };
    kv: {
        get: (key: string) => Promise<string | null | undefined>;
        set: (key: string, value: string) => Promise<boolean | undefined>;
        delete: (key: string) => Promise<boolean | undefined>;
        list: (
            pattern: string,
            returnValues?: boolean
        ) => Promise<string[] | KVItem[] | undefined>;
        flush: () => Promise<boolean | undefined>;
    };

    init: () => void;
    clearError: () => void;
}

// Local IndexedDB file storage helper
const DB_NAME = "cvision_local_db";
const STORE_NAME = "files";

const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            return reject(new Error("IndexedDB is not available"));
        }
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "path" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveLocalBlob = async (path: string, blob: Blob, name: string): Promise<FSItem> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const item: FSItem & { blob: Blob } = {
                id: Math.random().toString(36).substring(2),
                uid: "local",
                name,
                path,
                is_dir: false,
                parent_id: "root",
                parent_uid: "local",
                created: Date.now(),
                modified: Date.now(),
                accessed: Date.now(),
                size: blob.size,
                writable: true,
                blob,
            };
            const req = store.put(item);
            req.onsuccess = () => resolve(item);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return {
            id: Math.random().toString(36).substring(2),
            uid: "local",
            name,
            path,
            is_dir: false,
            parent_id: "root",
            parent_uid: "local",
            created: Date.now(),
            modified: Date.now(),
            accessed: Date.now(),
            size: blob.size,
            writable: true,
        };
    }
};

const getLocalBlob = async (path: string): Promise<Blob | undefined> => {
    if (path.startsWith("/") || path.startsWith("http")) {
        try {
            const res = await fetch(path);
            if (res.ok) return await res.blob();
        } catch {
            // Ignore and check indexedDB
        }
    }

    try {
        const db = await getDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(path);
            req.onsuccess = () => {
                if (req.result && req.result.blob) {
                    resolve(req.result.blob);
                } else {
                    resolve(undefined);
                }
            };
            req.onerror = () => resolve(undefined);
        });
    } catch {
        return undefined;
    }
};

const deleteLocalBlob = async (path: string): Promise<void> => {
    try {
        const db = await getDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(path);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
    } catch {
        // Ignore
    }
};

const listLocalBlobs = async (): Promise<FSItem[]> => {
    try {
        const db = await getDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch {
        return [];
    }
};

// Common stopwords to ignore in keyword matching
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
    "descripcion", "descripción", "description", "laboral", "empleo", "oferta", "vacancy"
]);

// Extract significant domain/tech keywords
const extractSignificantKeywords = (text: string): string[] => {
    if (!text) return [];
    const tokens = text
        .toLowerCase()
        .replace(/[^a-záéíóúüñ0-9+#./-]/gi, " ")
        .split(/\s+/)
        .filter(token => token.length > 2 && !STOPWORDS.has(token));

    const counts: Record<string, number> = {};
    tokens.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
    });

    return Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, 15);
};

// Pure, deterministic ATS & Keyword Analysis Engine with dynamic language support
export const generateResumeFeedback = (
    resumeData: {
        rawText?: string;
        jobTitle?: string;
        jobDescription?: string;
    },
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

    // --- Keyword Gap Analysis ---
    const targetKeywords = extractSignificantKeywords(`${jobDesc ? jobDesc : jobTitle}`);
    const matchingKeywords: string[] = [];
    const missingKeywords: string[] = [];

    targetKeywords.forEach(kw => {
        if (textLower.includes(kw)) {
            matchingKeywords.push(kw);
        } else {
            missingKeywords.push(kw);
        }
    });

    const keywordMatchScore = targetKeywords.length > 0
        ? Math.round((matchingKeywords.length / targetKeywords.length) * 100)
        : 85;

    // --- Heuristic 1: Structure & Sections ---
    const hasContact = /@|linkedin|github|telefono|teléfono|phone|email|correo|\+?\d{8,}/i.test(resumeText);
    const hasExperience = /experiencia|experience|trayectoria|work history|historial laboral|empleo/i.test(textLower);
    const hasEducation = /educaci[oó]n|education|universidad|university|licenciatura|grado|bachelor|master|m[aá]ster/i.test(textLower);
    const hasSkills = /habilidades|skills|aptitudes|conocimientos|technologies|tecnolog[ií]as|herramientas|stack/i.test(textLower);
    const hasSummary = /resumen|summary|perfil|profile|sobre m[ií]|about me|objetivo/i.test(textLower);

    let structureScore = 42;
    if (hasContact) structureScore += 12;
    if (hasExperience) structureScore += 16;
    if (hasEducation) structureScore += 12;
    if (hasSkills) structureScore += 10;
    if (hasSummary) structureScore += 8;
    structureScore = Math.min(98, Math.max(35, structureScore));

    // --- Heuristic 2: Content & Metrics ---
    const metricMatches = resumeText.match(/\d+[\s]*(?:%|k|m|usd|eur|\$|a[ñn]os|years|usuarios|users|clientes|clients|ventas|sales|horas|hours|projects|proyectos)/gi) || [];
    const metricCount = metricMatches.length;

    let contentScore = 52;
    if (wordCount >= 200) contentScore += 14;
    else if (wordCount >= 100) contentScore += 8;
    if (metricCount >= 4) contentScore += 24;
    else if (metricCount >= 2) contentScore += 14;
    else if (metricCount >= 1) contentScore += 8;
    contentScore = Math.min(96, Math.max(30, contentScore));

    // --- Heuristic 3: Tone & Action Verbs ---
    const actionVerbsEs = /lider[eé]|desarroll[eé]|dise[ñn][eé]|implement[eé]|optimiz[eé]|coordin[eé]|cre[eé]|aument[eé]|reduj[eé]|gestion[eé]|arquitectur/gi;
    const actionVerbsEn = /led|developed|designed|implemented|optimized|coordinated|created|increased|reduced|managed|engineered|built|architected/gi;
    const actionVerbCount = (resumeText.match(isSpanish ? actionVerbsEs : actionVerbsEn) || []).length;

    const passivePhrases = /responsable de|ayud[eé] a|particip[eé] en|assisted with|helped to|responsible for/gi;
    const passiveCount = (resumeText.match(passivePhrases) || []).length;

    let toneScore = 62;
    if (actionVerbCount >= 4) toneScore += 24;
    else if (actionVerbCount >= 2) toneScore += 14;
    else if (actionVerbCount >= 1) toneScore += 8;
    if (passiveCount > 2) toneScore -= 10;
    toneScore = Math.min(97, Math.max(35, toneScore));

    // --- Heuristic 4: Skills Score ---
    let skillsScore = Math.round((keywordMatchScore * 0.6) + (hasSkills ? 35 : 15));
    skillsScore = Math.min(98, Math.max(35, skillsScore));

    // --- ATS Overall Score ---
    const atsScore = Math.round((structureScore * 0.28) + (skillsScore * 0.32) + (contentScore * 0.25) + (toneScore * 0.15));
    const overall = Math.round((atsScore * 0.35) + (contentScore * 0.25) + (structureScore * 0.2) + (toneScore * 0.1) + (skillsScore * 0.1));

    // Bullet rewrites with Google XYZ formula
    const bulletRewrites: BulletRewrite[] = [
        {
            originalTip: isSpanish ? "Cuantificar logros con métricas" : "Quantify achievements with metrics",
            suggestedRewrite: isSpanish
                ? `Optimicé el flujo de trabajo para ${jobTitle}, logrando un aumento del 28% en la velocidad de entrega mediante la adopción de herramientas modernas y mejores prácticas.`
                : `Engineered core workflows for ${jobTitle}, resulting in a 28% increase in delivery speed by implementing standardized CI/CD and modular architecture.`,
            reasoning: isSpanish
                ? "Aplica la fórmula Google: Logro específico + Impacto numérico + Método de implementación."
                : "Applies Google XYZ format: Specific achievement + Quantified metric + Mechanism of execution."
        },
        {
            originalTip: isSpanish ? "Evitar lenguaje pasivo" : "Eliminate passive phrasing",
            suggestedRewrite: isSpanish
                ? `Lideré el diseño e implementación de la arquitectura técnica, reduciendo los tiempos de respuesta en un 35%.`
                : `Spearheaded end-to-end technical execution, slashing system response latency by 35%.`,
            reasoning: isSpanish
                ? "Reemplaza 'responsable de' por un verbo de acción directo ('Lideré') y asocia un resultado medible."
                : "Replaces passive duty descriptions with high-impact proactive verbs."
        }
    ];

    if (isSpanish) {
        return {
            overallScore: overall,
            keywords: {
                matchScore: keywordMatchScore,
                matching: matchingKeywords,
                missing: missingKeywords,
            },
            bulletRewrites,
            ATS: {
                score: atsScore,
                tips: [
                    hasExperience && hasEducation
                        ? {
                            type: "good",
                            tip: "Encabezados estándar y estructura compatible con los analizadores ATS más utilizados.",
                        }
                        : {
                            type: "improve",
                            tip: "Asegúrate de incluir secciones claramente tituladas: 'Experiencia Laboral', 'Educación' y 'Habilidades'.",
                        },
                    matchingKeywords.length >= 3
                        ? {
                            type: "good",
                            tip: `Buena densidad de palabras clave alineadas con el puesto de ${jobTitle}.`,
                        }
                        : {
                            type: "improve",
                            tip: `Incorpora más términos y requisitos específicos del rol de ${jobTitle} a lo largo de tu CV.`,
                        },
                    metricCount >= 2
                        ? {
                            type: "good",
                            tip: "Presencia de logros cuantificados mediante métricas y cifras concretas.",
                        }
                        : {
                            type: "improve",
                            tip: "Cuantifica tus responsabilidades con resultados medibles (% de eficiencia, tiempo o costos ahorrados).",
                        },
                    hasContact
                        ? {
                            type: "good",
                            tip: "Datos de contacto identificables para los reclutadores.",
                        }
                        : {
                            type: "improve",
                            tip: "Verifica que tu correo electrónico, teléfono y enlace a LinkedIn sean fácilmente legibles.",
                        },
                ],
            },
            toneAndStyle: {
                score: toneScore,
                tips: [
                    actionVerbCount >= 2
                        ? {
                            type: "good",
                            tip: "Verbos de Acción Efectivos",
                            explanation: "Tus viñetas utilizan verbos contundentes que transmiten proactividad y autonomía.",
                        }
                        : {
                            type: "improve",
                            tip: "Utilizar Verbos de Acción Fuertes",
                            explanation: "Comienza cada viñeta con verbos como 'Lideré', 'Desarrollé', 'Implementé' u 'Optimicé'.",
                        },
                    passiveCount > 0
                        ? {
                            type: "improve",
                            tip: "Evitar Lenguaje Pasivo",
                            explanation: "Reemplaza fórmulas como 'Responsable de' o 'Ayudé a' por acciones directas y asertivas.",
                        }
                        : {
                            type: "good",
                            tip: "Tono Profesional y Directo",
                            explanation: "El lenguaje utilizado es asertivo y centrado en la ejecución.",
                        },
                ],
            },
            content: {
                score: contentScore,
                tips: [
                    metricCount >= 2
                        ? {
                            type: "good",
                            tip: "Impacto Cuantificado",
                            explanation: "Respaldaste tus responsabilidades con métricas numéricas concretas.",
                        }
                        : {
                            type: "improve",
                            tip: "Añadir Métricas y Resultados",
                            explanation: "Asocia cada función principal a un indicador de éxito (ej. porcentaje de mejora, reducción de tiempos).",
                        },
                    wordCount >= 200
                        ? {
                            type: "good",
                            tip: "Profundidad de Contenido Adecuada",
                            explanation: "El nivel de detalle describe con claridad tus responsabilidades profesionales.",
                        }
                        : {
                            type: "improve",
                            tip: "Ampliar Detalle de Experiencias",
                            explanation: "Tu CV es breve. Explica con mayor detalle los proyectos y tecnologías que dominas.",
                        },
                ],
            },
            structure: {
                score: structureScore,
                tips: [
                    hasExperience && hasSkills
                        ? {
                            type: "good",
                            tip: "Organización Modular Clara",
                            explanation: "Las secciones principales están claramente diferenciadas para una lectura ágil.",
                        }
                        : {
                            type: "improve",
                            tip: "Completar Secciones Fundamentales",
                            explanation: "Asegúrate de estructurar el CV con: Perfil, Experiencia Laboral, Educación y Habilidades.",
                        },
                    {
                        type: "good",
                        tip: "Formato Cronológico Estándar",
                        explanation: "La presentación facilita la comprensión inmediata de tu evolución profesional.",
                    },
                ],
            },
            skills: {
                score: skillsScore,
                tips: [
                    hasSkills
                        ? {
                            type: "good",
                            tip: "Sección de Habilidades Presente",
                            explanation: "El documento incluye un apartado específico para tus competencias técnicas.",
                        }
                        : {
                            type: "improve",
                            tip: "Crear Sección de Habilidades",
                            explanation: "Agrega un bloque dedicado a Habilidades Técnicas, Frameworks y Herramientas.",
                        },
                    matchingKeywords.length >= 3
                        ? {
                            type: "good",
                            tip: "Coincidencia con la Oferta",
                            explanation: `Detectamos términos clave requeridos por la vacante (${matchingKeywords.slice(0, 4).join(", ")}).`,
                        }
                        : {
                            type: "improve",
                            tip: "Optimizar Palabras Clave",
                            explanation: missingKeywords.length > 0
                                ? `Te recomendamos incorporar términos de la oferta como: ${missingKeywords.slice(0, 4).join(", ")}.`
                                : `Incluye certificaciones y términos tecnológicos estándar para el rol de ${jobTitle}.`,
                        },
                ],
            },
        };
    }

    return {
        overallScore: overall,
        keywords: {
            matchScore: keywordMatchScore,
            matching: matchingKeywords,
            missing: missingKeywords,
        },
        bulletRewrites,
        ATS: {
            score: atsScore,
            tips: [
                hasExperience && hasEducation
                    ? {
                        type: "good",
                        tip: "Standard section headers ensuring high parseability across ATS platforms.",
                    }
                    : {
                        type: "improve",
                        tip: "Ensure clearly labeled sections: 'Work Experience', 'Education', and 'Skills'.",
                    },
                matchingKeywords.length >= 3
                    ? {
                        type: "good",
                        tip: `Solid keyword alignment matching the role of ${jobTitle}.`,
                    }
                    : {
                        type: "improve",
                        tip: `Incorporate more target keywords and domain skills corresponding to ${jobTitle}.`,
                    },
                metricCount >= 2
                    ? {
                        type: "good",
                        tip: "Strong presence of quantified achievements and measurable metrics.",
                    }
                    : {
                        type: "improve",
                        tip: "Quantify your achievements with concrete metrics (% improvements, time/cost savings).",
                    },
                hasContact
                    ? {
                        type: "good",
                        tip: "Contact information easily identifiable by hiring managers and parsers.",
                    }
                    : {
                        type: "improve",
                        tip: "Make sure your email, phone number, and LinkedIn URL are prominent and clean.",
                    },
            ],
        },
        toneAndStyle: {
            score: toneScore,
            tips: [
                actionVerbCount >= 2
                    ? {
                        type: "good",
                        tip: "Strong Action Verbs",
                        explanation: "Bullet points lead with powerful action verbs conveying autonomy and leadership.",
                    }
                    : {
                        type: "improve",
                        tip: "Leverage Action Verbs",
                        explanation: "Start bullet points with definitive verbs like 'Spearheaded', 'Engineered', 'Orchestrated', or 'Optimized'.",
                    },
                passiveCount > 0
                    ? {
                        type: "improve",
                        tip: "Eliminate Passive Phrasing",
                        explanation: "Replace passive phrases like 'Responsible for' or 'Helped with' with active, direct contribution statements.",
                    }
                    : {
                        type: "good",
                        tip: "Assertive Tone",
                        explanation: "Resume maintains a direct, professional and achievement-oriented tone.",
                    },
            ],
        },
        content: {
            score: contentScore,
            tips: [
                metricCount >= 2
                    ? {
                        type: "good",
                        tip: "Quantified Impact",
                        explanation: "You backed up your responsibilities with tangible numbers and deliverables.",
                    }
                    : {
                        type: "improve",
                        tip: "Add Quantifiable Metrics",
                        explanation: "Connect each core responsibility to a tangible business or technical outcome.",
                    },
                wordCount >= 200
                    ? {
                        type: "good",
                        tip: "Optimal Detail Depth",
                        explanation: "The depth of explanations effectively captures your scope of work.",
                    }
                    : {
                        type: "improve",
                        tip: "Expand Experience Details",
                        explanation: "Your resume content is brief. Provide more details on technical projects and contributions.",
                    },
            ],
        },
        structure: {
            score: structureScore,
            tips: [
                hasExperience && hasSkills
                    ? {
                        type: "good",
                        tip: "Clean Modular Layout",
                        explanation: "Clear separation between Experience, Education, and Technical Competencies.",
                    }
                    : {
                        type: "improve",
                        tip: "Organize Core Sections",
                        explanation: "Ensure standard chronological sections: Summary, Experience, Education, and Skills.",
                    },
                {
                    type: "good",
                    tip: "Reverse Chronological Order",
                    explanation: "Layout provides an immediate, scannable overview of your career progression.",
                },
            ],
        },
        skills: {
            score: skillsScore,
            tips: [
                hasSkills
                    ? {
                        type: "good",
                        tip: "Dedicated Skills Section",
                        explanation: "Document has a clear area highlighting technical competencies.",
                    }
                    : {
                        type: "improve",
                        tip: "Create Categorized Skills Section",
                        explanation: "Group skills into Core Languages, Frameworks, and Tools for faster recruiter evaluation.",
                    },
                matchingKeywords.length >= 3
                    ? {
                        type: "good",
                        tip: "Job Match Alignment",
                        explanation: `Key keywords from the target job were found in your profile (${matchingKeywords.slice(0, 4).join(", ")}).`,
                    }
                    : {
                        type: "improve",
                        tip: "Targeted Industry Keywords",
                        explanation: missingKeywords.length > 0
                            ? `Consider integrating missing job requirements: ${missingKeywords.slice(0, 4).join(", ")}.`
                            : `Ensure specific industry certifications and tools for ${jobTitle} are prominently featured.`,
                    },
            ],
        },
    };
};

const analyzeResumeContent = (instructionMessage: string): Feedback => {
    const isSpanish = /IDIOMA ESPAÑOL|puesto objetivo|currículum/i.test(instructionMessage);

    let jobTitle = isSpanish ? "Puesto Profesional" : "Professional Role";
    const jobTitleMatch = instructionMessage.match(/(?:The job title is|El título del puesto objetivo es):\s*([^\n\r]*)/i);
    if (jobTitleMatch && jobTitleMatch[1]?.trim() && !jobTitleMatch[1].includes("No especificado") && !jobTitleMatch[1].includes("Not specified")) {
        jobTitle = jobTitleMatch[1].trim();
    }

    const jobDescMatch = instructionMessage.match(/(?:The job description is|La descripción de la oferta laboral es):\s*([^\n\r]*)/i);
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

const defaultLocalUser: AppUser = {
    uuid: "local-user-id",
    username: "Local User",
};

export const useAppStore = create<AppStore>((set, get) => {
    const checkAuthStatus = async (): Promise<boolean> => {
        set({
            auth: {
                user: defaultLocalUser,
                isAuthenticated: true,
                signIn: get().auth.signIn,
                signOut: get().auth.signOut,
                refreshUser: get().auth.refreshUser,
                checkAuthStatus: get().auth.checkAuthStatus,
                getUser: () => defaultLocalUser,
            },
            isLoading: false,
        });
        return true;
    };

    const signIn = async (): Promise<void> => {
        await checkAuthStatus();
    };

    const signOut = async (): Promise<void> => {
        await checkAuthStatus();
    };

    const refreshUser = async (): Promise<void> => {
        await checkAuthStatus();
    };

    const init = (): void => {
        set({ ready: true, isLoading: false });
        checkAuthStatus();
    };

    const write = async (path: string, data: string | File | Blob) => {
        const blob = typeof data === "string" ? new Blob([data], { type: "text/plain" }) : data;
        const name = path.split("/").pop() || "file";
        await saveLocalBlob(path, blob, name);
        return undefined;
    };

    const readDir = async (_path: string) => {
        return listLocalBlobs();
    };

    const readFile = async (path: string): Promise<Blob | undefined> => {
        return getLocalBlob(path);
    };

    const upload = async (files: File[] | Blob[]): Promise<FSItem | undefined> => {
        const firstFile = files[0];
        if (!firstFile) return undefined;

        const fileName = (firstFile as File).name || `upload_${Date.now()}.bin`;
        const path = `local://${Date.now()}_${fileName}`;
        return saveLocalBlob(path, firstFile, fileName);
    };

    const deleteFile = async (path: string) => {
        await deleteLocalBlob(path);
    };

    const runAIInference = async (message: string): Promise<string> => {
        const provider = (import.meta.env.VITE_AI_PROVIDER || "offline").toLowerCase();
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
        const groqKey = import.meta.env.VITE_GROQ_API_KEY || "";
        const ollamaEndpoint = import.meta.env.VITE_OLLAMA_ENDPOINT || "http://localhost:11434";
        const ollamaModel = import.meta.env.VITE_OLLAMA_MODEL || "llama3";

        // 1. Google Gemini API (if VITE_AI_PROVIDER=gemini)
        if (provider === "gemini" && geminiKey) {
            try {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: message }] }],
                            generationConfig: {
                                responseMimeType: "application/json",
                            },
                        }),
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return text.trim();
                }
            } catch (err) {
                console.warn("Gemini API error, using heuristic fallback:", err);
            }
        }

        // 2. Groq Cloud API (if VITE_AI_PROVIDER=groq)
        if (provider === "groq" && groqKey) {
            try {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${groqKey}`,
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [{ role: "user", content: message }],
                        response_format: { type: "json_object" },
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    const text = data.choices?.[0]?.message?.content;
                    if (text) return text.trim();
                }
            } catch (err) {
                console.warn("Groq API error, using heuristic fallback:", err);
            }
        }

        // 3. Ollama Local (if VITE_AI_PROVIDER=ollama)
        if (provider === "ollama") {
            try {
                const res = await fetch(`${ollamaEndpoint}/api/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: ollamaModel,
                        prompt: message,
                        format: "json",
                        stream: false,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.response) return data.response.trim();
                }
            } catch (err) {
                console.warn("Ollama API error, using heuristic fallback:", err);
            }
        }

        // Default & Fallback: Heuristic Engine
        const fallbackAnalysis = analyzeResumeContent(message);
        return JSON.stringify(fallbackAnalysis);
    };

    const chat = async (
        prompt: string | ChatMessage[]
    ): Promise<AIResponse | undefined> => {
        const promptText = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
        const content = await runAIInference(promptText);
        return {
            index: 0,
            message: {
                role: "assistant",
                content,
                refusal: null,
                annotations: [],
            },
            logprobs: null,
            finish_reason: "stop",
            usage: [],
            via_ai_chat_service: false,
        };
    };

    const feedback = async (_path: string, message: string): Promise<AIResponse | undefined> => {
        const content = await runAIInference(message);
        return {
            index: 0,
            message: {
                role: "assistant",
                content,
                refusal: null,
                annotations: [],
            },
            logprobs: null,
            finish_reason: "stop",
            usage: [],
            via_ai_chat_service: false,
        };
    };

    const img2txt = async (_image: string | File | Blob) => {
        return "Extracted resume text...";
    };

    const getKV = async (key: string) => {
        if (typeof localStorage !== "undefined") {
            return localStorage.getItem(key);
        }
        return null;
    };

    const setKV = async (key: string, value: string) => {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(key, value);
            return true;
        }
        return true;
    };

    const deleteKV = async (key: string) => {
        if (typeof localStorage !== "undefined") {
            localStorage.removeItem(key);
            return true;
        }
        return true;
    };

    const listKV = async (pattern: string, returnValues = false) => {
        if (typeof localStorage !== "undefined") {
            const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
            const results: any[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && regex.test(k)) {
                    if (returnValues) {
                        results.push({ key: k, value: localStorage.getItem(k) || "" });
                    } else {
                        results.push(k);
                    }
                }
            }
            return results;
        }
        return [];
    };

    const flushKV = async () => {
        if (typeof localStorage !== "undefined") {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith("resume:")) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
        }
        return true;
    };

    return {
        isLoading: false,
        error: null,
        ready: true,
        auth: {
            user: defaultLocalUser,
            isAuthenticated: true,
            signIn,
            signOut,
            refreshUser,
            checkAuthStatus,
            getUser: () => defaultLocalUser,
        },
        fs: {
            write,
            read: readFile,
            readDir,
            upload,
            delete: deleteFile,
        },
        ai: {
            chat,
            feedback,
            img2txt,
        },
        kv: {
            get: getKV,
            set: setKV,
            delete: deleteKV,
            list: listKV,
            flush: flushKV,
        },
        init,
        clearError: () => set({ error: null }),
    };
});
