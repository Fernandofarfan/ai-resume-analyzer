import React, { useState, useEffect } from "react";
import { useI18nStore } from "~/lib/i18n";

interface CoverLetterModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyName?: string;
    jobTitle?: string;
    jobDescription?: string;
    feedback: Feedback;
}

const CoverLetterModal: React.FC<CoverLetterModalProps> = ({
    isOpen,
    onClose,
    companyName = "la empresa",
    jobTitle = "el puesto objetivo",
    jobDescription = "",
    feedback,
}) => {
    const { t, language } = useI18nStore();
    const [letterText, setLetterText] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const isSpanish = language === "es";
            const date = new Date().toLocaleDateString(isSpanish ? "es-ES" : "en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });

            const company = companyName || (isSpanish ? "su prestigiosa organización" : "your organization");
            const role = jobTitle || (isSpanish ? "el puesto correspondiente" : "the target role");

            if (isSpanish) {
                setLetterText(
`${date}

Estimado/a ${t.coverLetter.recipient},

Me dirijo a ustedes con gran entusiasmo para presentar mi candidatura para el puesto de ${role} en ${company}.

Tras analizar los requerimientos de la posición, considero que mi trayectoria profesional y mis competencias técnicas se encuentran estrechamente alineadas con los objetivos de su equipo. A lo largo de mi experiencia, me he enfocado en generar valor medible, resolver problemas técnicos de alta complejidad y aplicar metodologías ágiles que garantizan una entrega de software robusta y escalable.

Entre mis principales fortalezas destacan:
• Liderazgo técnico y ejecución orientada a resultados concretos.
• Dominio de herramientas y arquitecturas modernas demandadas por la industria.
• Compromiso con la calidad de código, la optimización continua y la colaboración interdisciplinaria.

La oportunidad de integrarme a ${company} representa un paso natural en mi desarrollo profesional, donde confío en aportar soluciones innovadoras que impulsen el éxito de sus proyectos.

Agradezco de antemano el tiempo dedicado a revisar mi perfil y quedo a su entera disposición para coordinar una entrevista.

Atentamente,

[Tu Nombre y Apellido]
[Teléfono] | [Correo Electrónico] | [LinkedIn / Portafolio]`
                );
            } else {
                setLetterText(
`${date}

Dear ${t.coverLetter.recipient},

I am writing to express my strong interest in the ${role} position at ${company}.

Having thoroughly reviewed the role's qualifications and expectations, I am confident that my technical background, problem-solving mindset, and track record of delivering measurable business impact make me an ideal candidate for your team.

Key highlights of my background include:
• Proven ability to architect and deploy scalable, high-performance technical solutions.
• Deep familiarity with modern technology stacks, agile execution, and cross-functional leadership.
• Relentless focus on code quality, quantifiable metric improvements, and user-centric results.

Joining ${company} represents an exciting opportunity to contribute directly to your mission while continuing to build impactful solutions.

Thank you for your time and consideration. I welcome the opportunity to discuss how my experience and passion align with your needs in an interview.

Sincerely,

[Your Full Name]
[Phone Number] | [Email Address] | [LinkedIn / Portfolio URL]`
                );
            }
        }
    }, [isOpen, companyName, jobTitle, jobDescription, language, feedback, t]);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(letterText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text:", err);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([letterText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Carta_Presentacion_${(companyName || "Empresa").replace(/\s+/g, "_")}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>✉️</span>
                            <span>{t.coverLetter.modalTitle}</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {t.coverLetter.subtitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
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
