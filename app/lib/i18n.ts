import { create } from "zustand";

export type Language = "es" | "en";

export interface Translations {
    navbar: {
        appName: string;
        tagline: string;
        uploadResume: string;
    };
    home: {
        pageTitle: string;
        metaDescription: string;
        badge: string;
        heroTitle: string;
        heroSubtitle: string;
        noResumesTitle: string;
        reviewResumesSub: string;
        uploadFirstButton: string;
        defaultResumeTitle: string;
        searchPlaceholder: string;
        filterAll: string;
        filterHigh: string;
        filterMedium: string;
        filterLow: string;
        resumesFound: string;
        loadingResumes: string;
        noResultsTitle: string;
        noResultsDesc: string;
        emptyStateDesc: string;
    };
    upload: {
        pageTitle: string;
        badge: string;
        heading: string;
        subheading: string;
        companyNameLabel: string;
        companyNamePlaceholder: string;
        jobTitleLabel: string;
        jobTitlePlaceholder: string;
        jobDescriptionLabel: string;
        jobDescriptionPlaceholder: string;
        jobDescTip: string;
        uploadResumeLabel: string;
        clickToUpload: string;
        orDragAndDrop: string;
        pdfMaxSize: string;
        readyToAnalyze: string;
        removeFile: string;
        analyzeButton: string;
        statusUploading: string;
        statusConverting: string;
        statusUploadingImage: string;
        statusPreparing: string;
        statusAnalyzing: string;
        statusComplete: string;
        stepProgress: string;
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
        deleteResume: string;
        deleteConfirmTitle: string;
        deleteConfirmMessage: string;
        cancelDelete: string;
        confirmDelete: string;
        exportPdf: string;
        coverLetterBtn: string;
        previewTitle: string;
        openPdfNewTab: string;
        loadingPreview: string;
        generatingDiagnosis: string;
        categories: {
            toneAndStyle: string;
            content: string;
            structure: string;
            skills: string;
        };
    };
    keywords: {
        title: string;
        subtitle: string;
        matchRate: string;
        matchingKeywords: string;
        missingKeywords: string;
        noMatching: string;
        noMissing: string;
        tipMissing: string;
    };
    coverLetter: {
        modalTitle: string;
        subtitle: string;
        generating: string;
        copyBtn: string;
        copied: string;
        downloadTxt: string;
        close: string;
        recipient: string;
    };
    bulletImprover: {
        suggestedRewrite: string;
        googleFormula: string;
        whyBetter: string;
        applyIdea: string;
        copied: string;
    };
    theme: {
        toggleDark: string;
        toggleLight: string;
    };
    languageSelector: {
        spanish: string;
        english: string;
    };
}

export const translations: Record<Language, Translations> = {
    es: {
        navbar: {
            appName: "CVision AI",
            tagline: "Optimizador ATS & Analizador de CVs",
            uploadResume: "Analizar CV",
        },
        home: {
            pageTitle: "CVision AI | Analizador y Optimizador ATS de Currículums",
            metaDescription: "Auditoría inteligente de CVs, detección de palabras clave y puntuación ATS para maximizar tus entrevistas.",
            badge: "Motor ATS Inteligente & Heurístico",
            heroTitle: "Auditoría Inteligente & Optimización ATS",
            heroSubtitle: "Analiza la compatibilidad de tu currículum contra las ofertas laborales con métricas reales y recomendaciones estratégicas.",
            noResumesTitle: "Aún no tienes currículums analizados.",
            reviewResumesSub: "Historial de análisis y diagnóstico de compatibilidad ATS.",
            uploadFirstButton: "Subir tu primer CV",
            defaultResumeTitle: "Currículum Profesional",
            searchPlaceholder: "Buscar por empresa, puesto o palabra clave...",
            filterAll: "Todos",
            filterHigh: "Alto (> 80)",
            filterMedium: "Medio (50-79)",
            filterLow: "Bajo (< 50)",
            resumesFound: "currículums encontrados",
            loadingResumes: "Cargando currículums analizados...",
            noResultsTitle: "No se encontraron resultados",
            noResultsDesc: "Prueba ajustando los filtros de búsqueda o el rango de puntuación.",
            emptyStateDesc: "Sube tu archivo PDF y la oferta laboral para obtener un desglose completo de puntuación ATS y palabras clave faltantes.",
        },
        upload: {
            pageTitle: "CVision AI | Subir y Analizar",
            badge: "Auditoría de Compatibilidad",
            heading: "Diagnóstico de CV y Compatibilidad ATS",
            subheading: "Sube tu archivo PDF y la descripción del puesto para un análisis comparativo y sugerencias de impacto.",
            companyNameLabel: "Empresa de Destino (Opcional)",
            companyNamePlaceholder: "Ej. Google, Mercado Libre, Spotify",
            jobTitleLabel: "Puesto Objetivo (Recomendado)",
            jobTitlePlaceholder: "Ej. Senior Frontend Developer, Data Scientist",
            jobDescriptionLabel: "Descripción o Requisitos de la Oferta",
            jobDescriptionPlaceholder: "Pega aquí los requerimientos, responsabilidades y tecnologías de la vacante para un análisis de keywords preciso...",
            jobDescTip: "Pegar los requisitos del puesto permite auditar palabras clave faltantes y evaluar tu compatibilidad exacta.",
            uploadResumeLabel: "Subir Currículum en PDF",
            clickToUpload: "Haz clic para subir tu PDF",
            orDragAndDrop: "o arrastra y suelta el archivo aquí",
            pdfMaxSize: "PDF (hasta 20 MB)",
            readyToAnalyze: "Listo para analizar",
            removeFile: "Quitar archivo",
            analyzeButton: "Iniciar Auditoría con IA",
            statusUploading: "Cargando archivo PDF...",
            statusConverting: "Renderizando vista previa de alta resolución...",
            statusUploadingImage: "Extrayendo texto y estructura...",
            statusPreparing: "Mapeando competencias y requisitos...",
            statusAnalyzing: "Calculando puntuación ATS y analizando vacante...",
            statusComplete: "¡Auditoría completada! Redirigiendo...",
            stepProgress: "Paso {step} de 5 • Procesando datos",
            errorUploadFile: "Error: No se pudo subir el archivo",
            errorConvertPdf: "Error: No se pudo procesar el PDF",
            errorUploadImage: "Error: Falló la generación de la vista previa",
            errorAnalyze: "Error: Falló el análisis heurístico",
        },
        resume: {
            pageTitle: "CVision AI | Reporte de Auditoría",
            metaDescription: "Reporte detallado de métricas ATS y recomendaciones para tu CV",
            backToHome: "Volver al Panel",
            reviewHeading: "Reporte de Diagnóstico ATS",
            overallScoreTitle: "Puntuación de Impacto Global",
            overallScoreSub: "Evaluación calculada a partir de parseabilidad ATS, densidad de métricas, estructura y tono profesional.",
            atsTitle: "Compatibilidad ATS",
            atsSubGood: "Perfil Altamente Competitivo",
            atsSubStart: "Buen Nivel Base",
            atsSubImprove: "Requiere Ajustes Críticos",
            atsDescription: "Estimación del rendimiento de tu CV ante los algoritmos de filtrado automático (Applicant Tracking Systems).",
            atsEncouragement: "Optimiza los puntos señalados para aumentar exponencialmente tu tasa de conversión a entrevistas.",
            deleteResume: "Eliminar",
            deleteConfirmTitle: "¿Eliminar este análisis?",
            deleteConfirmMessage: "Esta acción borrará permanentemente el PDF, la vista previa y el reporte de diagnóstico.",
            cancelDelete: "Cancelar",
            confirmDelete: "Confirmar Borrado",
            exportPdf: "Exportar Reporte",
            coverLetterBtn: "Generar Carta de Presentación",
            previewTitle: "Vista previa de documento",
            openPdfNewTab: "Abrir PDF en pestaña nueva ↗",
            loadingPreview: "Cargando vista previa...",
            generatingDiagnosis: "Generando diagnóstico...",
            categories: {
                toneAndStyle: "Tono & Verbos de Acción",
                content: "Impacto Cuantificado & Logros",
                structure: "Estructura & Jerarquía ATS",
                skills: "Habilidades & Palabras Clave",
            },
        },
        keywords: {
            title: "Diagnóstico de Palabras Clave (Keywords)",
            subtitle: "Comparación de términos técnicos y competencias entre tu CV y la oferta laboral.",
            matchRate: "Coincidencia de Keywords",
            matchingKeywords: "Keywords Detectadas en tu CV",
            missingKeywords: "Keywords Críticas Faltantes",
            noMatching: "No se detectaron coincidencias directas de palabras clave.",
            noMissing: "¡Excelente! Tu CV cubre los principales términos de la oferta.",
            tipMissing: "Tip: Incorpora estas palabras clave en tu sección de experiencia o habilidades para mejorar tu filtro ATS.",
        },
        coverLetter: {
            modalTitle: "Carta de Presentación Personalizada",
            subtitle: "Generada automáticamente alineando tu trayectoria con los requisitos de la vacante.",
            generating: "Redactando carta de presentación a medida...",
            copyBtn: "Copiar al Portapapeles",
            copied: "¡Copiado!",
            downloadTxt: "Descargar .TXT",
            close: "Cerrar",
            recipient: "Equipo de Selección / Hiring Manager",
        },
        bulletImprover: {
            suggestedRewrite: "Sugerencia con Fórmula de Google (XYZ)",
            googleFormula: "Logré [X], medido por [Y], implementando [Z]",
            whyBetter: "Por qué funciona mejor:",
            applyIdea: "Copiar Sugerencia",
            copied: "✓ Copiado",
        },
        theme: {
            toggleDark: "Cambiar a Modo Oscuro",
            toggleLight: "Cambiar a Modo Claro",
        },
        languageSelector: {
            spanish: "Español",
            english: "English",
        },
    },
    en: {
        navbar: {
            appName: "CVision AI",
            tagline: "ATS Optimizer & Resume Analyzer",
            uploadResume: "Analyze Resume",
        },
        home: {
            pageTitle: "CVision AI | Smart ATS Resume Analyzer & Optimizer",
            metaDescription: "Comprehensive resume audit, keyword matching, and ATS score optimization for landing interviews.",
            badge: "Intelligent & Heuristic ATS Engine",
            heroTitle: "Smart Resume Audit & ATS Optimization",
            heroSubtitle: "Benchmark your resume against target job requirements with deterministic metrics and actionable advice.",
            noResumesTitle: "No analyzed resumes yet.",
            reviewResumesSub: "Audit history and ATS compatibility breakdown.",
            uploadFirstButton: "Upload Your First Resume",
            defaultResumeTitle: "Professional Resume",
            searchPlaceholder: "Search by company, role, or keyword...",
            filterAll: "All",
            filterHigh: "High (> 80)",
            filterMedium: "Medium (50-79)",
            filterLow: "Low (< 50)",
            resumesFound: "resumes found",
            loadingResumes: "Loading analyzed resumes...",
            noResultsTitle: "No results found",
            noResultsDesc: "Try adjusting your search query or score filters.",
            emptyStateDesc: "Upload your PDF resume and target job posting to get a full ATS breakdown and missing keyword report.",
        },
        upload: {
            pageTitle: "CVision AI | Upload & Analyze",
            badge: "Compatibility Audit",
            heading: "Resume Diagnosis & ATS Compatibility",
            subheading: "Upload your PDF resume and target job description for a comprehensive gap analysis and impact tips.",
            companyNameLabel: "Target Company (Optional)",
            companyNamePlaceholder: "e.g. Google, Microsoft, Stripe",
            jobTitleLabel: "Target Role (Recommended)",
            jobTitlePlaceholder: "e.g. Senior Frontend Engineer, ML Specialist",
            jobDescriptionLabel: "Job Description / Requirements",
            jobDescriptionPlaceholder: "Paste the job responsibilities, skills, and qualifications here for keyword gap analysis...",
            jobDescTip: "Pasting the job description enables keyword gap analysis and precise job matching evaluation.",
            uploadResumeLabel: "Upload Resume in PDF",
            clickToUpload: "Click to upload your PDF",
            orDragAndDrop: "or drag and drop your file here",
            pdfMaxSize: "PDF (up to 20 MB)",
            readyToAnalyze: "Ready to analyze",
            removeFile: "Remove file",
            analyzeButton: "Run AI Audit",
            statusUploading: "Uploading PDF file...",
            statusConverting: "Rendering high-res preview...",
            statusUploadingImage: "Extracting text and section topology...",
            statusPreparing: "Mapping skills and qualifications...",
            statusAnalyzing: "Computing ATS score & vacancy alignment...",
            statusComplete: "Audit complete! Redirecting...",
            stepProgress: "Step {step} of 5 • Processing data",
            errorUploadFile: "Error: Could not upload file",
            errorConvertPdf: "Error: Failed to process PDF",
            errorUploadImage: "Error: Failed to generate page preview",
            errorAnalyze: "Error: Heuristic analysis failed",
        },
        resume: {
            pageTitle: "CVision AI | Audit Report",
            metaDescription: "Detailed ATS metrics and strategic recommendations for your resume",
            backToHome: "Back to Dashboard",
            reviewHeading: "ATS Diagnostic Report",
            overallScoreTitle: "Overall Impact Score",
            overallScoreSub: "Evaluated across ATS parseability, quantifiable achievements, layout hierarchy, and active tone.",
            atsTitle: "ATS Compatibility",
            atsSubGood: "Highly Competitive Profile",
            atsSubStart: "Solid Foundation",
            atsSubImprove: "Critical Adjustments Needed",
            atsDescription: "Estimated pass rate against automated Applicant Tracking Systems.",
            atsEncouragement: "Implement the recommendations below to substantially boost your recruiter response rate.",
            deleteResume: "Delete",
            deleteConfirmTitle: "Delete this audit?",
            deleteConfirmMessage: "This will permanently remove the PDF, image preview, and diagnostic report.",
            cancelDelete: "Cancel",
            confirmDelete: "Confirm Delete",
            exportPdf: "Export Report",
            coverLetterBtn: "Generate Cover Letter",
            previewTitle: "Document Preview",
            openPdfNewTab: "Open PDF in new tab ↗",
            loadingPreview: "Loading preview...",
            generatingDiagnosis: "Generating diagnosis...",
            categories: {
                toneAndStyle: "Tone & Action Verbs",
                content: "Quantified Impact & Scope",
                structure: "Layout & Section Hierarchy",
                skills: "Skills & Targeted Keywords",
            },
        },
        keywords: {
            title: "Keyword & Skill Gap Analysis",
            subtitle: "Direct comparison between your resume and the target job description requirements.",
            matchRate: "Keyword Match Rate",
            matchingKeywords: "Keywords Found in Resume",
            missingKeywords: "Critical Missing Keywords",
            noMatching: "No direct keyword matches detected.",
            noMissing: "Outstanding! Your resume covers all core keywords from the job posting.",
            tipMissing: "Tip: Integrate these missing keywords into your experience bullet points or skills section to boost ATS ranking.",
        },
        coverLetter: {
            modalTitle: "Tailored Cover Letter",
            subtitle: "Automatically drafted by aligning your background with the target job requirements.",
            generating: "Drafting your tailored cover letter...",
            copyBtn: "Copy to Clipboard",
            copied: "Copied!",
            downloadTxt: "Download .TXT",
            close: "Close",
            recipient: "Hiring Team / Recruiting Manager",
        },
        bulletImprover: {
            suggestedRewrite: "Google XYZ Formula Suggestion",
            googleFormula: "Accomplished [X], as measured by [Y], by doing [Z]",
            whyBetter: "Why this works better:",
            applyIdea: "Copy Suggestion",
            copied: "✓ Copied",
        },
        theme: {
            toggleDark: "Switch to Dark Mode",
            toggleLight: "Switch to Light Mode",
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
        const saved = localStorage.getItem("cvision_lang") as Language;
        if (saved === "es" || saved === "en") return saved;
        if (navigator.language.startsWith("es")) return "es";
    }
    return "es"; // Default to Spanish
};

export const useI18nStore = create<I18nStore>((set) => ({
    language: getInitialLanguage(),
    setLanguage: (lang: Language) => {
        if (typeof window !== "undefined") {
            localStorage.setItem("cvision_lang", lang);
        }
        set({
            language: lang,
            t: translations[lang],
        });
    },
    t: translations[getInitialLanguage()],
}));
