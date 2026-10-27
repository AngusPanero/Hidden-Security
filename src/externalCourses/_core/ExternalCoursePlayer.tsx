import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    AlertTriangle,
    Award,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileText,
    Layers,
    ListChecks,
    Loader2,
    Lock,
    Menu,
    PlayCircle,
    X,
} from "lucide-react";
import { useExternalCourse } from "./hooks/useExternalCourse";
import { getCourseCover, getPartnerBranding } from "./registry";
import { apiErrorMessage, type CourseStep, type StepType } from "./api/externalCoursesApi";
import PdfStep from "./steps/PdfStep";
import VideoStep from "./steps/VideoStep";
import QuizStep from "./steps/QuizStep";
import "./externalCourses.css";
import { UseTheme } from "../../contexts/ThemeContext";

// ─────────────────────────────────────────────────────────────────────
// Player único para TODOS los cursos de partners.
// Ruta: /cursos/:partnerSlug/:courseSlug
// ─────────────────────────────────────────────────────────────────────

const STEP_LABEL: Record<StepType, string> = {
    CONTENT: "LECTURA",
    VIDEO: "VIDEO",
    QUIZ: "EVALUACIÓN",
    FINAL_EXAM: "EVALUACIÓN FINAL",
};

const StepIcon = ({ type, size = 16 }: { type: StepType; size?: number }) => {
    if (type === "VIDEO") return <PlayCircle size={size} />;
    if (type === "QUIZ") return <ListChecks size={size} />;
    if (type === "FINAL_EXAM") return <Award size={size} />;
    return <FileText size={size} />;
};

const formatDuration = (min: number | null) => {
    if (!min) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h} H${m ? ` ${m} MIN` : ""}` : `${m} MIN`;
};

const ExternalCoursePlayer = () => {
    const { partnerSlug, courseSlug } = useParams();
    const navigate = useNavigate();
    const theme = UseTheme();
    const course = useExternalCourse(partnerSlug, courseSlug);
    const { structure, progress, steps, loading, error, busy } = course;

    const branding = getPartnerBranding(partnerSlug);
    const cover = getCourseCover(partnerSlug, courseSlug);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
    const [menuOpen, setMenuOpen] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const moduleOf = useMemo(() => {
        const map = new Map<string, string>();
        structure?.modules.forEach((m) => m.steps.forEach((s) => map.set(s.stepId, m.moduleId)));
        return map;
    }, [structure]);

    // Al cargar: abrir el step donde quedó el alumno
    useEffect(() => {
        if (!progress?.started || !steps.length || selectedId) return;
        const id = progress.currentStepId ?? steps[steps.length - 1].stepId;
        setSelectedId(id);
        const mod = moduleOf.get(id);
        if (mod) setOpenModules((o) => ({ ...o, [mod]: true }));
    }, [progress, steps, selectedId, moduleOf]);

    // Bloquear scroll del body con el temario abierto en mobile
    useEffect(() => {
        document.body.style.overflow = menuOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [menuOpen]);

    const rootClass = `xc-root${theme === "light" ? " xc-root--light" : ""}`;

    // ─── Estados de carga ────────────────────────────────────────────
    if (loading) {
        return (
            <div className={rootClass}>
                <div className="xc-center">
                    <Loader2 className="xc-spin" size={28} />
                    <span>CARGANDO CURSO</span>
                </div>
            </div>
        );
    }

    if (error || !structure || !progress) {
        return (
            <div className={rootClass}>
                <div className="xc-center xc-center--error">
                    <AlertTriangle size={28} />
                    <h2>{error?.status === 404 ? "CURSO NO ENCONTRADO" : "NO PODÉS ACCEDER A ESTE CURSO"}</h2>
                    <p>{error?.message}</p>
                    <button className="xc-btn xc-btn--ghost" onClick={() => navigate(-1)}>
                        <ChevronLeft size={16} />
                        VOLVER
                    </button>
                </div>
            </div>
        );
    }

    const info = structure.course;
    const partnerName = branding?.name || structure.partner.name;
    const partnerLogo = branding?.logo || structure.partner.logoUrl || null;

    // ─── Pantalla de inicio ──────────────────────────────────────────
    if (!progress.started) {
        const handleStart = async () => {
            setActionError(null);
            try {
                await course.start();
            } catch (err) {
                setActionError(apiErrorMessage(err));
            }
        };

        return (
            <div className={rootClass}>
                <section className="xc-intro">
                    {cover && <img className="xc-intro-cover" src={cover} alt="" />}
                    <div className="xc-intro-body">
                        <div className="xc-partner">
                            {partnerLogo && <img src={partnerLogo} alt="" />}
                            <span>CURSO DE {partnerName.toUpperCase()}</span>
                        </div>
                        <h1>{info.title}</h1>
                        {info.description && <p className="xc-intro-desc">{info.description}</p>}

                        <div className="xc-stats">
                            <span>
                                <Layers size={16} />
                                {info.moduleCount} MÓDULOS
                            </span>
                            <span>
                                <ListChecks size={16} />
                                {info.totalSteps} PASOS
                            </span>
                            {formatDuration(info.estimatedDurationMinutes) && (
                                <span>
                                    <Clock size={16} />
                                    {formatDuration(info.estimatedDurationMinutes)}
                                </span>
                            )}
                        </div>

                        {info.status === "DRAFT" && <div className="xc-draft">BORRADOR · SOLO ADMIN</div>}

                        <ol className="xc-intro-modules">
                            {structure.modules.map((m, i) => (
                                <li key={m.moduleId}>
                                    <span className="xc-module-num">{String(i + 1).padStart(2, "0")}</span>
                                    {m.title}
                                </li>
                            ))}
                        </ol>

                        {actionError && (
                            <div className="xc-alert">
                                <AlertTriangle size={16} />
                                {actionError}
                            </div>
                        )}

                        <button className="xc-btn xc-btn--primary xc-btn--lg" onClick={handleStart} disabled={busy}>
                            {busy ? <Loader2 className="xc-spin" size={18} /> : <PlayCircle size={18} />}
                            EMPEZAR CURSO
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    // ─── Player ──────────────────────────────────────────────────────
    const selected = steps.find((s) => s.stepId === selectedId) ?? steps[0];
    const selectedIndex = steps.indexOf(selected);
    const selectedModule = structure.modules.find((m) => m.moduleId === moduleOf.get(selected.stepId));
    const prevStep = selectedIndex > 0 ? steps[selectedIndex - 1] : null;
    const nextStep = selectedIndex < steps.length - 1 ? steps[selectedIndex + 1] : null;
    const selectedDone = course.isStepCompleted(selected.stepId);

    const goTo = (step: CourseStep) => {
        if (!course.isStepUnlocked(step)) return;
        setSelectedId(step.stepId);
        setActionError(null);
        setMenuOpen(false);
        const mod = moduleOf.get(step.stepId);
        if (mod) setOpenModules((o) => ({ ...o, [mod]: true }));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleComplete = async () => {
        setActionError(null);
        try {
            await course.completeStep(selected.stepId);
            // Recién completado → el siguiente queda desbloqueado
            if (nextStep) {
                setSelectedId(nextStep.stepId);
                const mod = moduleOf.get(nextStep.stepId);
                if (mod) setOpenModules((o) => ({ ...o, [mod]: true }));
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        } catch (err) {
            setActionError(apiErrorMessage(err));
        }
    };

    const renderStep = () => {
        if (selected.type === "CONTENT") {
            return (
                <PdfStep
                    partnerSlug={course.partnerSlug}
                    courseSlug={course.courseSlug}
                    step={selected}
                    completed={selectedDone}
                    busy={busy}
                    onComplete={handleComplete}
                />
            );
        }
        if (selected.type === "VIDEO") {
            return <VideoStep step={selected} completed={selectedDone} busy={busy} onComplete={handleComplete} />;
        }
        return (
            <QuizStep
                step={selected}
                result={progress.quizResults[selected.stepId]}
                busy={busy}
                hasNext={!!nextStep}
                onSubmit={course.submitQuiz}
                onContinue={() => nextStep && goTo(nextStep)}
            />
        );
    };

    return (
        <div className={rootClass}>
            {/* Header */}
            <header className="xc-header">
                <button className="xc-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir temario">
                    <Menu size={20} />
                </button>
                <div className="xc-header-titles">
                    <div className="xc-partner">
                        {partnerLogo && <img src={partnerLogo} alt="" />}
                        <span>{partnerName.toUpperCase()}</span>
                    </div>
                    <h1>{info.title}</h1>
                </div>
                <div className="xc-header-progress">
                    <span>{Math.round(progress.progressPercentage)}%</span>
                    <div className="xc-bar">
                        <div className="xc-bar-fill" style={{ width: `${progress.progressPercentage}%` }} />
                    </div>
                </div>
            </header>

            {progress.isCompleted && (
                <div className="xc-completed-banner">
                    <Award size={18} />
                    CURSO COMPLETADO
                </div>
            )}

            <div className="xc-layout">
                {/* Temario */}
                <div
                    className={`xc-backdrop${menuOpen ? " xc-backdrop--open" : ""}`}
                    onClick={() => setMenuOpen(false)}
                />
                <aside className={`xc-sidebar${menuOpen ? " xc-sidebar--open" : ""}`}>
                    <div className="xc-sidebar-head">
                        <span>TEMARIO</span>
                        <span className="xc-muted">
                            {progress.completedStepsCount}/{progress.totalSteps}
                        </span>
                        <button className="xc-close-btn" onClick={() => setMenuOpen(false)} aria-label="Cerrar">
                            <X size={18} />
                        </button>
                    </div>

                    {structure.modules.map((m, mi) => {
                        const done = m.steps.filter((s) => course.isStepCompleted(s.stepId)).length;
                        const isOpen = !!openModules[m.moduleId];
                        return (
                            <div key={m.moduleId} className="xc-module">
                                <button
                                    className="xc-module-head"
                                    onClick={() => setOpenModules((o) => ({ ...o, [m.moduleId]: !isOpen }))}
                                >
                                    <span className="xc-module-num">{String(mi + 1).padStart(2, "0")}</span>
                                    <span className="xc-module-title">{m.title}</span>
                                    <span className="xc-module-count">
                                        {done}/{m.steps.length}
                                    </span>
                                    <ChevronDown size={16} className={`xc-chevron${isOpen ? " xc-chevron--open" : ""}`} />
                                </button>

                                {isOpen && (
                                    <ul className="xc-step-list">
                                        {m.steps.map((s) => {
                                            const completed = course.isStepCompleted(s.stepId);
                                            const unlocked = course.isStepUnlocked(s);
                                            const active = s.stepId === selected.stepId;
                                            return (
                                                <li key={s.stepId}>
                                                    <button
                                                        className={[
                                                            "xc-step-item",
                                                            active && "xc-step-item--active",
                                                            completed && "xc-step-item--done",
                                                            !unlocked && "xc-step-item--locked",
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" ")}
                                                        onClick={() => goTo(s)}
                                                        disabled={!unlocked}
                                                    >
                                                        <span className="xc-step-status">
                                                            {completed ? (
                                                                <CheckCircle2 size={16} />
                                                            ) : !unlocked ? (
                                                                <Lock size={14} />
                                                            ) : (
                                                                <StepIcon type={s.type} />
                                                            )}
                                                        </span>
                                                        <span className="xc-step-name">{s.title}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </aside>

                {/* Contenido */}
                <main className="xc-main">
                    <div className="xc-step-head">
                        <span className="xc-eyebrow">
                            {selectedModule?.title} · <StepIcon type={selected.type} size={13} />{" "}
                            {STEP_LABEL[selected.type]}
                            {!selected.required && " · OPCIONAL"}
                        </span>
                        <h2>{selected.title}</h2>
                    </div>

                    {actionError && (
                        <div className="xc-alert">
                            <AlertTriangle size={16} />
                            {actionError}
                        </div>
                    )}

                    {renderStep()}

                    <nav className="xc-nav">
                        <button
                            className="xc-btn xc-btn--ghost"
                            onClick={() => prevStep && goTo(prevStep)}
                            disabled={!prevStep}
                        >
                            <ChevronLeft size={16} />
                            ANTERIOR
                        </button>
                        <span className="xc-muted">
                            {selectedIndex + 1} / {steps.length}
                        </span>
                        <button
                            className="xc-btn xc-btn--ghost"
                            onClick={() => nextStep && goTo(nextStep)}
                            disabled={!nextStep || !course.isStepUnlocked(nextStep)}
                        >
                            SIGUIENTE
                            <ChevronRight size={16} />
                        </button>
                    </nav>
                </main>
            </div>
        </div>
    );
};

export default ExternalCoursePlayer;