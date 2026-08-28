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
const DB_NAME = "resumind_local_db";
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

// Intelligent Local Bilingual ATS Feedback Generator
const generateMockFeedback = (instructionMessage: string): Feedback => {
    const isSpanish = /IDIOMA ESPAÑOL|puesto objetivo|currículum/i.test(instructionMessage);

    let jobTitle = isSpanish ? "Puesto Profesional" : "Professional Role";

    const jobTitleMatch = instructionMessage.match(/(?:The job title is|El título del puesto objetivo es):\s*([^\n\r]*)/i);
    if (jobTitleMatch && jobTitleMatch[1]?.trim() && !jobTitleMatch[1].includes("No especificado") && !jobTitleMatch[1].includes("Not specified")) {
        jobTitle = jobTitleMatch[1].trim();
    }

    const jobDescMatch = instructionMessage.match(/(?:The job description is|La descripción de la oferta laboral es):\s*([^\n\r]*)/i);
    const jobDesc = jobDescMatch && jobDescMatch[1]?.trim() && !jobDescMatch[1].includes("No especificada") && !jobDescMatch[1].includes("Not specified")
        ? jobDescMatch[1].trim()
        : "";

    const overall = Math.floor(Math.random() * 10) + 85;
    const atsScore = Math.floor(Math.random() * 8) + 88;

    if (isSpanish) {
        return {
            overallScore: overall,
            ATS: {
                score: atsScore,
                tips: [
                    {
                        type: "good",
                        tip: "Estructura limpia y encabezados estándar que facilitan el análisis por los principales sistemas ATS.",
                    },
                    {
                        type: "good",
                        tip: `Excelente densidad de palabras clave orientadas al rol de ${jobTitle}.`,
                    },
                    {
                        type: "improve",
                        tip: "Cuantifica tus logros con métricas concretas (% de mejora, tiempo o costos ahorrados).",
                    },
                    {
                        type: "improve",
                        tip: "Asegúrate de mantener un formato cronológico inverso homogéneo en toda tu trayectoria.",
                    },
                ],
            },
            toneAndStyle: {
                score: 88,
                tips: [
                    {
                        type: "good",
                        tip: "Verbos de Acción Contundentes",
                        explanation: "Las viñetas inician con verbos activos que demuestran liderazgo y autonomía profesional.",
                    },
                    {
                        type: "improve",
                        tip: "Evitar Expresiones Pasivas",
                        explanation: "Reemplaza frases como 'Responsable de' o 'Ayudé a' por verbos precisos como 'Lideré', 'Desarrollé' u 'Optimicé'.",
                    },
                ],
            },
            content: {
                score: 86,
                tips: [
                    {
                        type: "good",
                        tip: "Experiencia Pertinente",
                        explanation: `Tu historial profesional destaca competencias técnicas acordes a los requerimientos de ${jobTitle}.`,
                    },
                    {
                        type: "improve",
                        tip: "Destacar Resultados Concretos",
                        explanation: "Vincula cada responsabilidad importante con el impacto o valor generado para el negocio.",
                    },
                ],
            },
            structure: {
                score: 92,
                tips: [
                    {
                        type: "good",
                        tip: "Jerarquía Visual Clara",
                        explanation: "Separación clara e intuitiva entre Experiencia, Educación y Habilidades técnicas.",
                    },
                    {
                        type: "improve",
                        tip: "Organización de Habilidades",
                        explanation: "Agrupa tus conocimientos en categorías (Lenguajes, Frameworks y Herramientas) para una lectura rápida.",
                    },
                ],
            },
            skills: {
                score: 89,
                tips: [
                    {
                        type: "good",
                        tip: "Stack Tecnológico Demandado",
                        explanation: "Incluye herramientas modernas e indispensables para la industria actual.",
                    },
                    {
                        type: "improve",
                        tip: "Palabras Clave de la Vacante",
                        explanation: jobDesc
                            ? `Incorpora términos técnicos clave presentes en la oferta: "${jobDesc.slice(0, 60)}..."`
                            : `Añade palabras clave específicas y certificaciones demandadas para ${jobTitle}.`,
                    },
                ],
            },
        };
    }

    return {
        overallScore: overall,
        ATS: {
            score: atsScore,
            tips: [
                {
                    type: "good",
                    tip: "Clean structure and standard headers facilitate parsing by major ATS platforms.",
                },
                {
                    type: "good",
                    tip: `Strong keyword density corresponding to ${jobTitle}.`,
                },
                {
                    type: "improve",
                    tip: "Quantify your achievements with concrete metrics (e.g., % increase, hours saved, revenue).",
                },
                {
                    type: "improve",
                    tip: "Use standard reverse-chronological format across all employment history.",
                },
            ],
        },
        toneAndStyle: {
            score: 88,
            tips: [
                {
                    type: "good",
                    tip: "Impactful Action Verbs",
                    explanation: "Bullet points effectively start with proactive verbs showing strong individual contribution.",
                },
                {
                    type: "improve",
                    tip: "Eliminate Passive Phrasing",
                    explanation: "Replace passive phrases like 'Assisted with' or 'Helped to' with definitive verbs like 'Spearheaded' or 'Engineered'.",
                },
            ],
        },
        content: {
            score: 86,
            tips: [
                {
                    type: "good",
                    tip: "Relevant Experience",
                    explanation: `Work experience highlights practical competencies aligned with requirements for ${jobTitle}.`,
                },
                {
                    type: "improve",
                    tip: "Highlight Specific Outcomes",
                    explanation: "Connect each major responsibility to a measurable outcome or delivered project value.",
                },
            ],
        },
        structure: {
            score: 92,
            tips: [
                {
                    type: "good",
                    tip: "Intuitive Section Hierarchy",
                    explanation: "Clear visual hierarchy between Contact Info, Summary, Experience, Education, and Skills.",
                },
                {
                    type: "improve",
                    tip: "Categorized Skills Section",
                    explanation: "Categorize skills into Core, Frameworks, and Tools for faster recruiter review.",
                },
            ],
        },
        skills: {
            score: 89,
            tips: [
                {
                    type: "good",
                    tip: "Core Tech Stack",
                    explanation: "Mentions modern industry tools and technologies essential for the target role.",
                },
                {
                    type: "improve",
                    tip: "Targeted Keywords",
                    explanation: jobDesc
                        ? `Integrate more industry keywords found in the job posting: "${jobDesc.slice(0, 70)}..."`
                        : `Ensure specific industry terminology matching ${jobTitle} is prominently featured.`,
                },
            ],
        },
    };
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

    const chat = async (
        prompt: string | ChatMessage[]
    ): Promise<AIResponse | undefined> => {
        const promptText = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
        const mock = generateMockFeedback(promptText);
        return {
            index: 0,
            message: {
                role: "assistant",
                content: JSON.stringify(mock),
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
        const mock = generateMockFeedback(message);
        return {
            index: 0,
            message: {
                role: "assistant",
                content: JSON.stringify(mock),
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

// Backward compatibility alias
export const usePuterStore = useAppStore;
