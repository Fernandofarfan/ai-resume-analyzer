import React, { useState, useEffect } from "react";
import { useI18nStore } from "~/lib/i18n";
import { useDialog } from "~/lib/useDialog";
import { extractProfileSignals } from "~/lib/analysis/heuristic";
import type { Feedback } from "~/domain/feedback";

interface CoverLetterModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyName?: string;
    jobTitle?: string;
    jobDescription?: string;
    resumeText?: string;
    feedback: Feedback;
}

const CoverLetterModal: React.FC<CoverLetterModalProps> = ({
    isOpen,
    onClose,
    companyName,
    jobTitle,
    jobDescription = "",
    resumeText = "",
    feedback,
}) => {
    const { t, language } = useI18nStore();
    const [letterText, setLetterText] = useState("");
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const dialogRef = useDialog(isOpen, onClose);

    useEffect(() => {
        if (isOpen) {
            const isSpanish = language === "es";
            const date = new Date().toLocaleDateString(isSpanish ? "es-ES" : "en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });

            const company = companyName || (isSpanish ? "su organización" : "your organization");
            const role = jobTitle || (isSpanish ? "el puesto objetivo" : "the target role");

            // Only use skills that were actually detected in the resume — never
            // invent qualifications the candidate did not provide.
            const detectedSkills = (feedback.keywords?.matching || []).slice(0, 4);
            const signals = extractProfileSignals(resumeText);
            const hasJobDesc = Boolean(jobDescription && jobDescription.trim().length > 10);

            if (isSpanish) {
                const skillsLine = detectedSkills.length > 0
                    ? `Entre las competencias detectadas en mi perfil destacan: ${detectedSkills.join(", ")}.`
                    : "Cuento con una trayectoria profesional alineada con los requerimientos de la posición.";

                const jobAlignment = hasJobDesc
                    ? (detectedSkills.length > 0
                        ? `Al analizar la descripción del puesto y sus prioridades clave, considero que mi dominio de ${detectedSkills.join(", ")} encaja directamente con los objetivos de ${company}.`
                        : `He revisado detalladamente los desafíos descritos para la vacante y confío en mi capacidad para aportar soluciones efectivas a su equipo.`)
                    : "Estoy convencido/a de que mi experiencia puede aportar valor a su equipo, y me motiva la oportunidad de aplicar mis conocimientos en un entorno orientado a resultados.";

                const experienceLine = signals.yearsExperience
                    ? `Aporto ${signals.yearsExperience} años de experiencia profesional en el área.`
                    : "";
                const impactLine = signals.quantifiedAchievements > 0
                    ? " He orientado mi trabajo a generar resultados medibles y a asumir responsabilidades de forma proactiva."
                    : " He asumido responsabilidades de forma proactiva y he colaborado con equipos multidisciplinarios para alcanzar objetivos comunes.";

                setLetterText(
`${date}

Estimado/a ${t.coverLetter.recipient},

Me dirijo a ustedes para presentar mi candidatura al puesto de ${role} en ${company}.

${skillsLine} ${jobAlignment}

${experienceLine}${impactLine} Me entusiasma la posibilidad de contribuir al crecimiento de ${company} y de seguir desarrollándome profesionalmente en este rol.

Quedo a su disposición para ampliar cualquier información en una entrevista.

Atentamente,

[Tu Nombre y Apellido]
[Teléfono] | [Correo Electrónico] | [LinkedIn / Portafolio]`
                );
            } else {
                const skillsLine = detectedSkills.length > 0
                    ? `Key skills reflected in my background include: ${detectedSkills.join(", ")}.`
                    : "My professional background is closely aligned with the requirements of the role.";

                const jobAlignment = hasJobDesc
                    ? (detectedSkills.length > 0
                        ? `After carefully reviewing the requirements and priorities for this role, I believe my experience with ${detectedSkills.join(", ")} provides a strong foundation to deliver value quickly at ${company}.`
                        : `Having reviewed the key responsibilities described in the posting, I am confident in my ability to address your team's challenges effectively.`)
                    : "I am confident that my experience would allow me to contribute meaningfully to your team, and I am excited by the opportunity to apply my skills in a results-driven environment.";

                const experienceLine = signals.yearsExperience
                    ? `I bring ${signals.yearsExperience} years of professional experience in the field.`
                    : "";
                const impactLine = signals.quantifiedAchievements > 0
                    ? " I have focused my work on delivering measurable results and taking proactive ownership."
                    : " I have taken proactive ownership of my work and collaborated with cross-functional teams to achieve shared goals.";

                setLetterText(
`${date}

Dear ${t.coverLetter.recipient},

I am writing to express my interest in the ${role} position at ${company}.

${skillsLine} ${jobAlignment}

${experienceLine}${impactLine} I would welcome the chance to contribute to ${company}'s continued success and to grow professionally in this role.

Thank you for your time and consideration. I look forward to discussing how my background can support your team's objectives.

Sincerely,

[Your Full Name]
[Phone Number] | [Email Address] | [LinkedIn / Portfolio URL]`
                );
            }
        }
    }, [isOpen, companyName, jobTitle, jobDescription, resumeText, language, feedback, t]);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(letterText);
            setCopied(true);
            setCopyError(false);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text:", err);
            setCopyError(true);
            setTimeout(() => setCopyError(false), 3000);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([letterText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const prefix = language === "es" ? "Carta_Presentacion" : "Cover_Letter";
        const sanitized = (companyName || "")
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
            .replace(/\s+/g, "_")
            .slice(0, 80);
        const fallback = language === "es" ? "Empresa" : "Company";
        a.download = `${prefix}_${sanitized || fallback}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cover-letter-title"
                aria-describedby="cover-letter-subtitle"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h3 id="cover-letter-title" className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>✉️</span>
                            <span>{t.coverLetter.modalTitle}</span>
                        </h3>
                        <p id="cover-letter-subtitle" className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {t.coverLetter.subtitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t.coverLetter.close}
                        title={t.coverLetter.close}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Text Area Content */}
                <div className="my-4 flex-1 overflow-y-auto">
                    <textarea
                        id="cover-letter-textarea"
                        aria-labelledby="cover-letter-modal-title"
                        aria-describedby="cover-letter-subtitle"
                        rows={14}
                        value={letterText}
                        onChange={(e) => setLetterText(e.target.value)}
                        className="w-full text-sm font-mono leading-relaxed p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl resize-y focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleCopy}
                            aria-live="polite"
                            className="secondary-button text-xs font-semibold py-2 px-3.5"
                        >
                            {copied ? `✓ ${t.coverLetter.copied}` : `📋 ${t.coverLetter.copyBtn}`}
                        </button>
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="secondary-button text-xs font-semibold py-2 px-3.5"
                        >
                            💾 {t.coverLetter.downloadTxt}
                        </button>
                    </div>
                    {copyError && (
                        <span role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">
                            {t.coverLetter.copyError}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="primary-button text-xs font-semibold py-2 px-5"
                    >
                        {t.coverLetter.close}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CoverLetterModal;
