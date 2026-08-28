import { create } from "zustand";

export type Language = "es" | "en";

export interface Translations {
    navbar: {
        appName: string;
        uploadResume: string;
    };
    home: {
        pageTitle: string;
        metaDescription: string;
        heroTitle: string;
        noResumesTitle: string;
        reviewResumesSub: string;
        uploadFirstButton: string;
        defaultResumeTitle: string;
    };
    upload: {
        pageTitle: string;
        heading: string;
        subheading: string;
        companyNameLabel: string;
        companyNamePlaceholder: string;
        jobTitleLabel: string;
        jobTitlePlaceholder: string;
        jobDescriptionLabel: string;
        jobDescriptionPlaceholder: string;
        uploadResumeLabel: string;
        clickToUpload: string;
        orDragAndDrop: string;
        pdfMaxSize: string;
        analyzeButton: string;
        statusUploading: string;
        statusConverting: string;
        statusUploadingImage: string;
        statusPreparing: string;
        statusAnalyzing: string;
        statusComplete: string;
        errorUploadFile: string;
        errorConvertPdf: string;
        errorUploadImage: string;
        errorAnalyze: string;
    };
    resume: {
        pageTitle: string;
        metaDescription: string;
        backToHome: string;
        reviewHeading: string;
        overallScoreTitle: string;
        overallScoreSub: string;
        atsTitle: string;
        atsSubGood: string;
        atsSubStart: string;
        atsSubImprove: string;
        atsDescription: string;
        atsEncouragement: string;
        categories: {
            toneAndStyle: string;
            content: string;
            structure: string;
            skills: string;
        };
    };
    languageSelector: {
        spanish: string;
        english: string;
    };
}

export const translations: Record<Language, Translations> = {
    es: {
        navbar: {
            appName: "RESUMIND",
            uploadResume: "Subir Currículum",
        },
        home: {
            pageTitle: "Resumind | Analizador de Currículums con IA",
            metaDescription: "¡Feedback inteligente y puntuación ATS para conseguir el trabajo de tus sueños!",
            heroTitle: "Gestiona tus Postulaciones y Puntuaciones de CV",
            noResumesTitle: "No se encontraron currículums. Sube tu primer CV para obtener feedback.",
            reviewResumesSub: "Revisa tus postulaciones y consulta el análisis detallado con IA.",
            uploadFirstButton: "Subir Currículum",
            defaultResumeTitle: "Currículum",
        },
        upload: {
            pageTitle: "Resumind | Subir y Analizar",
            heading: "Feedback Inteligente para tu Trabajo Ideal",
            subheading: "Sube tu CV en PDF para obtener una puntuación ATS y recomendaciones de mejora",
            companyNameLabel: "Nombre de la Empresa",
            companyNamePlaceholder: "Ej. Google, Mercado Libre, Globant",
            jobTitleLabel: "Título del Puesto",
            jobTitlePlaceholder: "Ej. Frontend Developer, Data Analyst",
            jobDescriptionLabel: "Descripción del Puesto / Oferta Laboral",
            jobDescriptionPlaceholder: "Pega aquí los requisitos y responsabilidades de la oferta de trabajo...",
            uploadResumeLabel: "Subir Currículum en PDF",
            clickToUpload: "Haz clic para subir",
            orDragAndDrop: "o arrastra y suelta aquí",
            pdfMaxSize: "PDF (máx. 20 MB)",
            analyzeButton: "Analizar Currículum",
            statusUploading: "Subiendo el archivo...",
            statusConverting: "Convirtiendo a vista previa de imagen...",
            statusUploadingImage: "Procesando vista previa...",
            statusPreparing: "Preparando análisis...",
            statusAnalyzing: "Analizando currículum con IA y métricas ATS...",
            statusComplete: "¡Análisis completado! Redirigiendo...",
            errorUploadFile: "Error: No se pudo subir el archivo",
            errorConvertPdf: "Error: No se pudo convertir el PDF",
            errorUploadImage: "Error: No se pudo procesar la imagen del PDF",
            errorAnalyze: "Error: Falló el análisis del currículum",
        },
        resume: {
            pageTitle: "Resumind | Análisis de Currículum",
            metaDescription: "Revisión detallada y sugerencias de mejora para tu CV",
            backToHome: "Volver al Inicio",
            reviewHeading: "Evaluación de Currículum",
            overallScoreTitle: "Puntuación General del CV",
            overallScoreSub: "Esta puntuación se calcula según las categorías y criterios analizados a continuación.",
            atsTitle: "Puntuación ATS",
            atsSubGood: "¡Excelente Trabajo!",
            atsSubStart: "Buen Comienzo",
            atsSubImprove: "Requiere Mejoras",
            atsDescription: "Esta puntuación representa el desempeño esperado de tu CV en los sistemas de seguimiento de candidatos (ATS) utilizados por reclutadores.",
            atsEncouragement: "Continúa optimizando tu currículum para maximizar tus posibilidades de superar los filtros ATS y captar la atención de los reclutadores.",
            categories: {
                toneAndStyle: "Tono y Estilo",
                content: "Contenido y Logros",
                structure: "Estructura y Formato",
                skills: "Habilidades y Palabras Clave",
            },
        },
        languageSelector: {
            spanish: "Español",
            english: "English",
        },
    },
    en: {
        navbar: {
            appName: "RESUMIND",
            uploadResume: "Upload Resume",
        },
        home: {
            pageTitle: "Resumind | AI Resume Analyzer",
            metaDescription: "Smart feedback for your dream job!",
            heroTitle: "Track Your Applications & Resume Ratings",
            noResumesTitle: "No resumes found. Upload your first resume to get feedback.",
            reviewResumesSub: "Review your submissions and check AI-powered feedback.",
            uploadFirstButton: "Upload Resume",
            defaultResumeTitle: "Resume",
        },
        upload: {
            pageTitle: "Resumind | Upload & Analyze",
            heading: "Smart feedback for your dream job",
            subheading: "Drop your resume for an ATS score and improvement tips",
            companyNameLabel: "Company Name",
            companyNamePlaceholder: "e.g. Google, Microsoft, Apple",
            jobTitleLabel: "Job Title",
            jobTitlePlaceholder: "e.g. Frontend Developer, Cloud Engineer",
            jobDescriptionLabel: "Job Description",
            jobDescriptionPlaceholder: "Paste the job requirements and responsibilities here...",
            uploadResumeLabel: "Upload Resume",
            clickToUpload: "Click to upload",
            orDragAndDrop: "or drag and drop",
            pdfMaxSize: "PDF (max 20 MB)",
            analyzeButton: "Analyze Resume",
            statusUploading: "Uploading the file...",
            statusConverting: "Converting to image...",
            statusUploadingImage: "Uploading the image...",
            statusPreparing: "Preparing data...",
            statusAnalyzing: "Analyzing with AI & ATS metrics...",
            statusComplete: "Analysis complete, redirecting...",
            errorUploadFile: "Error: Failed to upload file",
            errorConvertPdf: "Error: Failed to convert PDF to image",
            errorUploadImage: "Error: Failed to upload image",
            errorAnalyze: "Error: Failed to analyze resume",
        },
        resume: {
            pageTitle: "Resumind | Review",
            metaDescription: "Detailed overview of your resume",
            backToHome: "Back to Homepage",
            reviewHeading: "Resume Review",
            overallScoreTitle: "Your Resume Score",
            overallScoreSub: "This score is calculated based on the variables listed below.",
            atsTitle: "ATS Score",
            atsSubGood: "Great Job!",
            atsSubStart: "Good Start",
            atsSubImprove: "Needs Improvement",
            atsDescription: "This score represents how well your resume is likely to perform in Applicant Tracking Systems used by employers.",
            atsEncouragement: "Keep refining your resume to improve your chances of getting past ATS filters and into the hands of recruiters.",
            categories: {
                toneAndStyle: "Tone & Style",
                content: "Content & Impact",
                structure: "Structure & Layout",
                skills: "Skills & Keywords",
            },
        },
        languageSelector: {
            spanish: "Español",
            english: "English",
        },
    },
};

interface I18nStore {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
}

const getInitialLanguage = (): Language => {
    if (typeof window !== "undefined") {
        const saved = localStorage.getItem("resumind_lang") as Language;
        if (saved === "es" || saved === "en") return saved;
        if (navigator.language.startsWith("es")) return "es";
    }
    return "es"; // Default to Spanish
};

export const useI18nStore = create<I18nStore>((set) => ({
    language: getInitialLanguage(),
    setLanguage: (lang: Language) => {
        if (typeof window !== "undefined") {
            localStorage.setItem("resumind_lang", lang);
        }
        set({
            language: lang,
            t: translations[lang],
        });
    },
    t: translations[getInitialLanguage()],
}));
