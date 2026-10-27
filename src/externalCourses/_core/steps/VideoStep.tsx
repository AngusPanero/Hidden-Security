import { CheckCircle2, Loader2 } from "lucide-react";
import type { CourseStep } from "../api/externalCoursesApi";

interface Props {
    step: CourseStep;
    completed: boolean;
    busy: boolean;
    onComplete: () => void;
}

// Video embebido desde la URL del course.config.js (YouTube, Vimeo, etc.)

const VideoStep = ({ step, completed, busy, onComplete }: Props) => {
    return (
        <div className="xc-step xc-step--video">
            <div className="xc-video-frame">
                {step.url ? (
                    <iframe
                        src={step.url}
                        title={step.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                    />
                ) : (
                    <div className="xc-pdf-state">VIDEO NO DISPONIBLE</div>
                )}
            </div>

            <div className="xc-step-actions">
                {completed ? (
                    <span className="xc-done-chip">
                        <CheckCircle2 size={16} />
                        VISTO
                    </span>
                ) : (
                    <button className="xc-btn xc-btn--primary" onClick={onComplete} disabled={busy}>
                        {busy ? <Loader2 className="xc-spin" size={16} /> : <CheckCircle2 size={16} />}
                        MARCAR COMO VISTO
                    </button>
                )}
            </div>
        </div>
    );
};

export default VideoStep;