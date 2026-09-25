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
        exportBackup: string;
        importBackup: string;
        importSuccess: string;
        importError: string;
        importPartial: string;
        localStorageNotice: string;
        storageQuota: string;
        exportPasswordPrompt: string;
        exportPasswordConfirm: string;
        exportPasswordMismatch: string;
        exportPasswordTooShort: string;
        importPasswordPrompt: string;
        importPasswordRequired: string;
        importPasswordIncorrect: string;
        importCorruptedArchive: string;
        decryptButton: string;
        cancelButton: string;
        passwordPlaceholder: string;
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
        errorSave: string;
        errorStorageQuota: string;
        privacyConsent: string;
        cancelButton: string;
        warningInvalidAI: string;
        fileTooLarge: string;
        fileInvalidType: string;
        tooManyFiles: string;
        fileRejected: string;
        scannedPdfWarning: string;
        scannedPdfError: string;
        columnsWarning: string;
        errorConsent: string;
        errorUnauthorized: string;
        apiKeyLabel: string;
        apiKeyPlaceholder: string;
        modeLocal: string;
        modeRemote: string;
        modeOllama: string;
        modeUnknown: string;
        modeServerUnavailable: string;
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
        sourceAI: string;
        sourceHeuristic: string;
        analyzedLabel: string;
        reportNotFoundTitle: string;
        reportNotFoundDesc: string;
        reportErrorTitle: string;
        reportErrorDesc: string;
        storageErrorTitle: string;
        storageErrorDesc: string;
        deleteError: string;
        deleting: string;
        fallbackNotice: string;
        scannedPdfWarning: string;
        attachmentsStorageError: string;
        attachmentsNoFiles: string;
        attachmentsPartial: string;
        confidenceLow: string;
        confidenceMedium: string;
        confidenceHigh: string;
        confidenceLowHint: string;
        confidenceMediumHint: string;
        confidenceHighHint: string;
        factorsTitle: string;
        factorsSubtitle: string;
        factorsList: {
            textClarity: string;
            jobMatch: string;
            keywordsDensity: string;
            metricsFormula: string;
            structureAts: string;
        };
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
        notEvaluable: string;
        notEvaluableHint: string;
    };
    coverLetter: {
        modalTitle: string;
        subtitle: string;
        generating: string;
        copyBtn: string;
        copied: string;
        copyError: string;
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
        copyError: string;
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
            filterHigh: "Alto (≥ 80)",
            filterMedium: "Medio (50-79)",
            filterLow: "Bajo (< 50)",
            resumesFound: "currículums encontrados",
            loadingResumes: "Cargando currículums analizados...",
            noResultsTitle: "No se encontraron resultados",
            noResultsDesc: "Prueba ajustando los filtros de búsqueda o el rango de puntuación.",
            emptyStateDesc: "Sube tu archivo PDF y la oferta laboral para obtener un desglose completo de puntuación ATS y palabras clave faltantes.",
            exportBackup: "Exportar Copia (JSON)",
            importBackup: "Importar Copia",
            importSuccess: "Copia de seguridad restaurada correctamente ({count} currículums).",
            importPartial: "Se restauraron {restored} currículums ({skipped} omitidos por errores).",
            importError: "No se pudo restaurar el archivo: {error}",
            localStorageNotice: "Almacenamiento 100% privado en tu navegador (IndexedDB)",
            storageQuota: "Espacio local usado: {used} MB de {quota} MB ({percent}%)",
            exportPasswordPrompt: "Opcional: Establece una contraseña para cifrar tu copia de seguridad (AES-GCM-256).\nDéjala en blanco para exportar sin cifrar:",
            exportPasswordConfirm: "Confirma tu contraseña de cifrado:",
            exportPasswordMismatch: "Las contraseñas no coinciden. Exportación cancelada.",
            exportPasswordTooShort: "La contraseña debe tener al menos 6 caracteres.",
            importPasswordPrompt: "Esta copia de seguridad está cifrada. Ingresa la contraseña para descifrar:",
            importPasswordRequired: "Importación cancelada: Se requiere la contraseña para descifrar la copia de seguridad.",
            importPasswordIncorrect: "Contraseña incorrecta o archivo de copia corrupto.",
            importCorruptedArchive: "El archivo cifrado está dañado o no es válido.",
            decryptButton: "Descifrar e Importar",
            cancelButton: "Cancelar",
            passwordPlaceholder: "Introduce la contraseña...",
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
            errorAnalyze: "Error: Falló el análisis",
            errorSave: "Error: No se pudo guardar el análisis en el navegador",
            errorStorageQuota: "Espacio de almacenamiento local insuficiente en tu navegador para procesar el archivo.",
            privacyConsent: "Consiento que el contenido de mi currículum y la oferta laboral se envíen a un proveedor de IA externo para generar el análisis. Consulta la política de privacidad de dicho proveedor para conocer su retención de datos.",
            cancelButton: "Cancelar",
            warningInvalidAI: "La respuesta de la IA no tenía un formato válido. Se utilizó el análisis local.",
            fileTooLarge: "El archivo supera el tamaño máximo de 20 MB.",
            fileInvalidType: "Solo se aceptan archivos PDF.",
            tooManyFiles: "Solo se puede subir un archivo a la vez.",
            fileRejected: "No se pudo aceptar el archivo.",
            scannedPdfWarning: "No se pudo extraer texto de este PDF; es posible que sea una imagen escaneada. El análisis se basará en datos limitados.",
            scannedPdfError: "Este PDF parece ser una imagen escaneada: no se pudo extraer texto. Sube un PDF con texto seleccionable para poder analizarlo.",
            columnsWarning: "Este PDF parece usar varias columnas. Revisa el texto extraído, ya que el análisis podría mezclar secciones.",
            errorConsent: "Se requiere tu consentimiento para enviar el CV a un proveedor de IA externo.",
            errorUnauthorized: "El servidor requiere autenticación. Configura el token de acceso o contacta al administrador.",
            apiKeyLabel: "Token de Acceso a la API (Opcional)",
            apiKeyPlaceholder: "Introduce el token si tu servidor lo requiere...",
            modeLocal: "Modo actual: análisis local. El CV no sale de este dispositivo.",
            modeRemote: "Modo actual: {provider}. El texto se enviará a este proveedor para generar el análisis.",
            modeOllama: "Modo actual: Ollama (servidor local). El texto se envía a tu servidor local de Ollama.",
            modeUnknown: "No se pudo determinar el modo del servidor. El análisis se realizará localmente.",
            modeServerUnavailable: "Servidor no disponible. Se utilizará el motor de análisis local.",
        },
        resume: {
            pageTitle: "CVision AI | Reporte de Auditoría",
            metaDescription: "Reporte detallado de métricas ATS y recomendaciones para tu CV",
            backToHome: "Volver al Panel",
            reviewHeading: "Reporte de Diagnóstico ATS",
            overallScoreTitle: "Puntuación de Impacto Global",
            overallScoreSub: "Estimación calculada a partir de parseabilidad ATS, densidad de métricas, estructura y tono profesional.",
            atsTitle: "Estimación de Compatibilidad ATS",
            atsSubGood: "Perfil Altamente Competitivo",
            atsSubStart: "Buen Nivel Base",
            atsSubImprove: "Requiere Ajustes Críticos",
            atsDescription: "Estimación basada en señales de contenido y estructura. No es una puntuación garantizada de ningún ATS específico.",
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
            sourceAI: "Análisis generado por IA",
            sourceHeuristic: "Análisis heurístico local",
            analyzedLabel: "Analizado el",
            reportNotFoundTitle: "Reporte no encontrado",
            reportNotFoundDesc: "El análisis solicitado no existe o fue eliminado. Vuelve al panel para revisar tu historial.",
            reportErrorTitle: "No se pudo cargar el reporte",
            reportErrorDesc: "Ocurrió un error al leer los datos almacenados o el archivo puede estar corrupto.",
            storageErrorTitle: "Almacenamiento no disponible",
            storageErrorDesc: "El almacenamiento local del navegador no está disponible (posiblemente bloqueado o en modo privado). No se pudo leer el archivo.",
            deleteError: "No se pudo eliminar por completo. Inténtalo de nuevo.",
            deleting: "Eliminando…",
            fallbackNotice: "El proveedor de IA no respondió. Se generó un análisis local alternativo.",
            scannedPdfWarning: "Este PDF parece ser una imagen escaneada: no se pudo extraer texto. El análisis se basará en datos limitados.",
            attachmentsStorageError: "Error de Almacenamiento",
            attachmentsNoFiles: "Sin Archivos",
            attachmentsPartial: "Parcial",
            confidenceLow: "Confianza baja",
            confidenceMedium: "Confianza media",
            confidenceHigh: "Confianza alta",
            confidenceLowHint: "Pocas señales disponibles (CV breve o sin oferta). Toma el resultado como orientativo.",
            confidenceMediumHint: "Señales suficientes, pero con margen de mejora en el detalle del CV o la oferta.",
            confidenceHighHint: "Basado en un CV detallado y una oferta laboral completa.",
            factorsTitle: "Factores de Puntuación",
            factorsSubtitle: "El puntaje es una estimación basada en 5 dimensiones objetivas de tu perfil:",
            factorsList: {
                textClarity: "Claridad y volumen del texto extraído del documento.",
                jobMatch: "Alineación semántica con la descripción y requisitos del puesto.",
                keywordsDensity: "Presencia y densidad de habilidades técnicas clave.",
                metricsFormula: "Impacto numérico y logros medibles (Fórmula Google X-Y-Z).",
                structureAts: "Estructura estándar, encabezados y formato legible para ATS.",
            },
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
            notEvaluable: "No evaluable",
            notEvaluableHint: "No se proporcionó una oferta laboral ni un puesto objetivo, por lo que no es posible calcular la coincidencia de palabras clave.",
        },
        coverLetter: {
            modalTitle: "Borrador de Carta de Presentación",
            subtitle: "Borrador generado localmente a partir de tu trayectoria y los requisitos de la vacante. Revísalo y personalízalo antes de enviarlo.",
            generating: "Redactando carta de presentación a medida...",
            copyBtn: "Copiar al Portapapeles",
            copied: "¡Copiado!",
            copyError: "No se pudo copiar. Tu navegador bloqueó el acceso al portapapeles.",
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
            copyError: "No se pudo copiar. Tu navegador bloqueó el acceso al portapapeles.",
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
            filterHigh: "High (≥ 80)",
            filterMedium: "Medium (50-79)",
            filterLow: "Low (< 50)",
            resumesFound: "resumes found",
            loadingResumes: "Loading analyzed resumes...",
            noResultsTitle: "No results found",
            noResultsDesc: "Try adjusting your search query or score filters.",
            emptyStateDesc: "Upload your PDF resume and target job posting to get a full ATS breakdown and missing keyword report.",
            exportBackup: "Export Backup (JSON)",
            importBackup: "Import Backup",
            importSuccess: "Backup successfully restored ({count} resumes).",
            importPartial: "Restored {restored} resumes ({skipped} skipped due to errors).",
            importError: "Failed to restore backup: {error}",
            localStorageNotice: "100% Private local browser storage (IndexedDB)",
            storageQuota: "Local storage used: {used} MB of {quota} MB ({percent}%)",
            exportPasswordPrompt: "Optional: Set a password to encrypt your backup (AES-GCM-256).\nLeave blank to export unencrypted:",
            exportPasswordConfirm: "Confirm your encryption password:",
            exportPasswordMismatch: "Passwords do not match. Export cancelled.",
            exportPasswordTooShort: "Password must be at least 6 characters.",
            importPasswordPrompt: "This backup is password-protected. Enter password to decrypt:",
            importPasswordRequired: "Import cancelled: Password is required to decrypt backup.",
            importPasswordIncorrect: "Incorrect password or corrupted backup archive.",
            importCorruptedArchive: "The encrypted file is damaged or invalid.",
            decryptButton: "Decrypt & Import",
            cancelButton: "Cancel",
            passwordPlaceholder: "Enter password...",
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
            errorAnalyze: "Error: Analysis failed",
            errorSave: "Error: Could not save the analysis in the browser",
            errorStorageQuota: "Insufficient local storage space in your browser to process this file.",
            privacyConsent: "I consent to sending my resume content and the job description to an external AI provider to generate the analysis. Please review that provider's privacy policy for data retention details.",
            cancelButton: "Cancel",
            warningInvalidAI: "The AI response was not in a valid format. Local analysis was used instead.",
            fileTooLarge: "The file exceeds the 20 MB size limit.",
            fileInvalidType: "Only PDF files are accepted.",
            tooManyFiles: "Only one file can be uploaded at a time.",
            fileRejected: "The file could not be accepted.",
            scannedPdfWarning: "No text could be extracted from this PDF; it may be a scanned image. Analysis will be based on limited data.",
            scannedPdfError: "This PDF appears to be a scanned image: no text could be extracted. Upload a PDF with selectable text to analyze it.",
            columnsWarning: "This PDF appears to use multiple columns. Review the extracted text, as the analysis may mix sections.",
            errorConsent: "Your consent is required to send the resume to an external AI provider.",
            errorUnauthorized: "The server requires authentication. Configure an access token or contact the administrator.",
            apiKeyLabel: "API Access Token (Optional)",
            apiKeyPlaceholder: "Enter authorization token if required by your server...",
            modeLocal: "Current mode: local analysis. Your resume never leaves this device.",
            modeRemote: "Current mode: {provider}. Your text will be sent to this provider to generate the analysis.",
            modeOllama: "Current mode: Ollama (local server). Your text is sent to your local Ollama server.",
            modeUnknown: "The server mode could not be determined. Analysis will run locally.",
            modeServerUnavailable: "Server unavailable. Local analysis engine will be used.",
        },
        resume: {
            pageTitle: "CVision AI | Audit Report",
            metaDescription: "Detailed ATS metrics and strategic recommendations for your resume",
            backToHome: "Back to Dashboard",
            reviewHeading: "ATS Diagnostic Report",
            overallScoreTitle: "Overall Impact Score",
            overallScoreSub: "Estimated from ATS parseability, quantifiable achievements, layout hierarchy, and active tone.",
            atsTitle: "Estimated ATS Compatibility",
            atsSubGood: "Highly Competitive Profile",
            atsSubStart: "Solid Foundation",
            atsSubImprove: "Critical Adjustments Needed",
            atsDescription: "Estimate based on content and structure signals. It is not a guaranteed score for any specific ATS.",
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
            sourceAI: "AI-generated analysis",
            sourceHeuristic: "Local heuristic analysis",
            analyzedLabel: "Analyzed on",
            reportNotFoundTitle: "Report not found",
            reportNotFoundDesc: "The requested analysis does not exist or was deleted. Return to the dashboard to review your history.",
            reportErrorTitle: "Could not load report",
            reportErrorDesc: "An error occurred while reading stored data, or the file may be corrupted.",
            storageErrorTitle: "Storage unavailable",
            storageErrorDesc: "Local browser storage is unavailable (possibly blocked or in private mode). The file could not be read.",
            deleteError: "Could not fully delete the analysis. Please try again.",
            deleting: "Deleting…",
            fallbackNotice: "The AI provider was unavailable. A local alternative analysis was generated.",
            scannedPdfWarning: "This PDF appears to be a scanned image: no text could be extracted. Analysis will be based on limited data.",
            attachmentsStorageError: "Storage Error",
            attachmentsNoFiles: "No Files",
            attachmentsPartial: "Partial",
            confidenceLow: "Low confidence",
            confidenceMedium: "Medium confidence",
            confidenceHigh: "High confidence",
            confidenceLowHint: "Few signals available (short resume or no job posting). Treat the result as indicative.",
            confidenceMediumHint: "Sufficient signals, but the resume or job posting could be more detailed.",
            confidenceHighHint: "Based on a detailed resume and a complete job posting.",
            factorsTitle: "Evaluation Factors",
            factorsSubtitle: "The score is an estimate based on 5 objective profile dimensions:",
            factorsList: {
                textClarity: "Volume and readability of the extracted text content.",
                jobMatch: "Semantic alignment with job description requirements.",
                keywordsDensity: "Coverage and density of target domain skills.",
                metricsFormula: "Measurable metrics and business impact (Google X-Y-Z formula).",
                structureAts: "Standard section headings, layout, and ATS parseability.",
            },
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
            notEvaluable: "Not evaluable",
            notEvaluableHint: "No job posting or target role was provided, so keyword matching cannot be calculated.",
        },
        coverLetter: {
            modalTitle: "Cover Letter Draft",
            subtitle: "A locally generated draft based on your background and the job requirements. Review and personalize it before sending.",
            generating: "Drafting your tailored cover letter...",
            copyBtn: "Copy to Clipboard",
            copied: "Copied!",
            copyError: "Copy failed. Your browser blocked clipboard access.",
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
            copyError: "Copy failed. Your browser blocked clipboard access.",
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
        try {
            const saved = localStorage.getItem("cvision_lang") as Language;
            if (saved === "es" || saved === "en") return saved;
        } catch {
            // Storage access restricted
        }
        try {
            if (navigator?.language?.startsWith("es")) return "es";
        } catch {
            // Navigator access restricted
        }
    }
    return "es"; // Default to Spanish
};

export const useI18nStore = create<I18nStore>((set) => ({
    language: getInitialLanguage(),
    setLanguage: (lang: Language) => {
        if (typeof window !== "undefined") {
            try {
                localStorage.setItem("cvision_lang", lang);
            } catch {
                // Storage access restricted
            }
        }
        set({
            language: lang,
            t: translations[lang],
        });
    },
    t: translations[getInitialLanguage()],
}));
