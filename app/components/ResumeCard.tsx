import { Link } from "react-router";
import ScoreCircle from "~/components/ScoreCircle";
import { useEffect, useState } from "react";
import { useAppStore } from "~/lib/store";
import { useI18nStore } from "~/lib/i18n";

const ResumeCard = ({
    resume: { id, companyName, jobTitle, feedback, imagePath },
    onDelete,
}: {
    resume: Resume;
    onDelete?: (id: string) => void;
}) => {
    const { fs } = useAppStore();
    const { t } = useI18nStore();
    const [resumeUrl, setResumeUrl] = useState("");

    useEffect(() => {
        let url: string | null = null;
        const loadResume = async () => {
            const blob = await fs.read(imagePath);
            if (!blob) return;
            url = URL.createObjectURL(blob);
            setResumeUrl(url);
        };

        loadResume();

        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [imagePath]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onDelete) {
            onDelete(id);
        }
    };

    return (
        <div className="relative group">
            <Link to={`/resume/${id}`} className="resume-card animate-in fade-in duration-1000 block hover:shadow-lg transition-all duration-300">
                <div className="resume-card-header">
                    <div className="flex flex-col gap-2">
                        {companyName && (
                            <h2 className="!text-black font-bold break-words">{companyName}</h2>
                        )}
                        {jobTitle && (
                            <h3 className="text-lg break-words text-gray-500">{jobTitle}</h3>
                        )}
                        {!companyName && !jobTitle && (
                            <h2 className="!text-black font-bold">{t.home.defaultResumeTitle}</h2>
                        )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                        <ScoreCircle score={feedback.overallScore} />
                        {onDelete && (
                            <button
                                type="button"
                                onClick={handleDeleteClick}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full cursor-pointer"
                                title={t.resume.deleteResume}
                            >
                                <img src="/icons/cross.svg" alt="delete" className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
                {resumeUrl && (
                    <div className="gradient-border animate-in fade-in duration-1000">
                        <div className="w-full h-full">
                            <img
                                src={resumeUrl}
                                alt="resume"
                                className="w-full h-[350px] max-sm:h-[200px] object-cover object-top"
                            />
                        </div>
                    </div>
                )}
            </Link>
        </div>
    );
};

export default ResumeCard;
