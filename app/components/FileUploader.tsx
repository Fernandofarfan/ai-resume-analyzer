import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { formatSize } from "../lib/utils";
import { useI18nStore } from "~/lib/i18n";

interface FileUploaderProps {
    file?: File | null;
    onFileSelect?: (file: File | null) => void;
}

const FileUploader = ({ file = null, onFileSelect }: FileUploaderProps) => {
    const { t } = useI18nStore();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        onFileSelect?.(acceptedFiles[0] || null);
    }, [onFileSelect]);

    const maxFileSize = 20 * 1024 * 1024; // 20MB in bytes

    const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
        onDrop,
        multiple: false,
        accept: { "application/pdf": [".pdf"] },
        maxSize: maxFileSize,
    });

    const rejectionMessage = (() => {
        const rejection = fileRejections[0];
        if (!rejection) return null;
        const code = rejection.errors[0]?.code;
        if (code === "file-too-large") return t.upload.fileTooLarge;
        if (code === "file-invalid-type") return t.upload.fileInvalidType;
        if (code === "too-many-files") return t.upload.tooManyFiles;
        return t.upload.fileRejected;
    })();

    return (
        <div className="w-full">
            {rejectionMessage && (
                <p role="alert" className="mb-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {rejectionMessage}
                </p>
            )}
            <div
                {...getRootProps()}
                className={`relative p-8 sm:p-10 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer text-center ${
                    isDragActive
                        ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 scale-101 ring-4 ring-indigo-500/20"
                        : file
                        ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10"
                        : "border-slate-300 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 hover:border-indigo-500/60 hover:bg-slate-50 dark:hover:bg-slate-900/90"
                }`}
            >
                <input {...getInputProps()} />

                {file ? (
                    <div
                        className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs shrink-0">
                                PDF
                            </div>
                            <div className="text-left min-w-0">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
                                    {file.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {formatSize(file.size)} • {t.upload.readyToAnalyze}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                onFileSelect?.(null);
                            }}
                            aria-label={t.upload.removeFile}
                            title={t.upload.removeFile}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                <span className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-500/40 underline-offset-4">
                                    {t.upload.clickToUpload}
                                </span>{" "}
                                {t.upload.orDragAndDrop}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                {t.upload.pdfMaxSize}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUploader;
