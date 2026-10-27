import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { externalCoursesApi, apiErrorStatus, type CourseStep } from "../api/externalCoursesApi";

interface Props {
    partnerSlug: string;
    courseSlug: string;
    step: CourseStep;
    completed: boolean;
    busy: boolean;
    onComplete: () => void;
}

// Pide el PDF al backend (con la cookie de sesión) y lo muestra desde un blob.
// La URL real del archivo nunca existe en el front.

const PdfStep = ({ partnerSlug, courseSlug, step, completed, busy, onComplete }: Props) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        let created: string | null = null;

        setLoading(true);
        setError(null);
        setUrl(null);

        externalCoursesApi
            .pdfBlobUrl(partnerSlug, courseSlug, step.stepId)
            .then((blobUrl) => {
                created = blobUrl;
                if (alive) setUrl(blobUrl);
                else URL.revokeObjectURL(blobUrl);
            })
            .catch((err) => {
                if (!alive) return;
                const status = apiErrorStatus(err);
                setError(
                    status === 409
                        ? "Completá los pasos anteriores para ver este contenido."
                        : "No se pudo cargar el documento."
                );
            })
            .finally(() => alive && setLoading(false));

        return () => {
            alive = false;
            if (created) URL.revokeObjectURL(created);
        };
    }, [partnerSlug, courseSlug, step.stepId]);

    return (
        <div className="xc-step xc-step--pdf">
            <div className="xc-pdf-frame">
                {loading && (
                    <div className="xc-pdf-state">
                        <Loader2 className="xc-spin" size={22} />
                        <span>CARGANDO DOCUMENTO</span>
                    </div>
                )}
                {error && (
                    <div className="xc-pdf-state xc-pdf-state--error">
                        <AlertTriangle size={22} />
                        <span>{error}</span>
                    </div>
                )}
                {url && <iframe src={`${url}#view=FitH`} title={step.title} />}
            </div>

            <div className="xc-step-actions">
                {url && (
                    <a className="xc-btn xc-btn--ghost" href={url} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} />
                        ABRIR EN PESTAÑA NUEVA
                    </a>
                )}

                {completed ? (
                    <span className="xc-done-chip">
                        <CheckCircle2 size={16} />
                        LEÍDO
                    </span>
                ) : (
                    <button
                        className="xc-btn xc-btn--primary"
                        onClick={onComplete}
                        disabled={busy || !url}
                    >
                        {busy ? <Loader2 className="xc-spin" size={16} /> : <CheckCircle2 size={16} />}
                        MARCAR COMO LEÍDO
                    </button>
                )}
            </div>
        </div>
    );
};

export default PdfStep;