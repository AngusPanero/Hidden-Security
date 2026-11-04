import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useExternalCourse } from "./hooks/useExternalCourse";
import { getCourseCover, getPartnerBranding } from "./registry";
import { apiErrorMessage, externalCoursesApi, type CourseApproval, type CourseStep, type StepType } from "./api/externalCoursesApi";
import PdfStep from "./steps/PdfStep";
import VideoStep from "./steps/VideoStep";
import QuizStep from "./steps/QuizStep";
import "./externalCourses.css";
import { UseTheme } from "../../contexts/ThemeContext";

// ─────────────────────────────────────────────────────────────────────
// Player único para TODOS los cursos de partners.
// Ruta: /cursos/:partnerSlug/:courseSlug
// Misma estética que Soc1Course (clases xs-, copia de las sc- de soc1Course.css).
// ─────────────────────────────────────────────────────────────────────

const STEP_ICONS: Record<StepType, string> = {
    CONTENT: "📄",
    VIDEO: "▶",
    QUIZ: "✎",
    FINAL_EXAM: "✎",
};

const formatDuration = (min: number | null) => {
    if (!min) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}H${m ? ` ${m}M` : ""}` : `${m}M`;
};

const toEyebrow = (text: string) =>
    `// ${text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "")}`;

// ── Barra de progreso ─────────────────────────────────────────────────
function ProgressBar({ completed, total, pct }: { completed: number; total: number; pct: number }) {
    const value = Math.round(pct);
    return (
        <div className="xs-progress-wrap">
            <div className="xs-progress-bar">
                <div className="xs-progress-fill" style={{ width: `${value}%` }} />
            </div>
            <span className="xs-progress-label">
                {value}% completado · {completed}/{total} etapas
            </span>
        </div>
    );
}

// ── Pantalla de finalización ──────────────────────────────────────────
// Muestra si aprobó (lo decide el backend), la nota y el certificado.
// Si el CV no tiene nombre y apellido, los pide para emitir el certificado.
const NAME_RE = /^[\p{L}][\p{L}' -]{1,59}$/u;

function CompletionScreen({
    courseTitle,
    partnerName,
    startedAt,
    completedAt,
    approval,
    busy,
    onReview,
    onGoToStep,
    onRefresh,
}: {
    courseTitle: string;
    partnerName: string;
    startedAt: string | null;
    completedAt: string | null;
    approval: CourseApproval;
    busy: boolean;
    onReview: () => void;
    onGoToStep: (stepId: string) => void;
    onRefresh: () => Promise<unknown>;
}) {
    const navigate = useNavigate();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const start = startedAt ? new Date(startedAt) : null;
    const end = completedAt ? new Date(completedAt) : null;
    const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

    let duration = "";
    if (start && end) {
        const ms = end.getTime() - start.getTime();
        const days = Math.floor(ms / 86_400_000);
        const hours = Math.floor((ms % 86_400_000) / 3_600_000);
        duration =
            days === 0 && hours === 0
                ? "menos de 1 hora"
                : [days > 0 && `${days} días`, hours > 0 && `${hours} horas`].filter(Boolean).join(" y ");
    }

    const scoreLabel = approval.score == null ? null : `${Math.round(approval.score * 100)}%`;
    const basisLabel = approval.basis === "FINAL_EXAM" ? "examen final" : "promedio de las evaluaciones";
    const cert = approval.certificate;

    // El link del certificado es absoluto (dominio público); se navega por su ruta
    const certPath = cert ? new URL(cert.url).pathname : null;

    const validName = NAME_RE.test(firstName.trim()) && NAME_RE.test(lastName.trim());

    const saveName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validName || saving) return;
        setSaving(true);
        setFormError("");
        try {
            await externalCoursesApi.saveHolderName(firstName.trim(), lastName.trim());
            await onRefresh(); // el backend completa el titular del certificado
        } catch (err) {
            setFormError(apiErrorMessage(err, "No se pudo guardar tu nombre. Intentá de nuevo."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="xs-completion">
            <div className={`xs-completion-badge${approval.approved ? "" : " xs-completion-badge--pending"}`}>
                {approval.approved ? "✓" : "!"}
            </div>
            <h2 className="xs-completion-title">{approval.approved ? "¡CURSO APROBADO!" : "CURSO COMPLETADO"}</h2>
            <p className="xs-completion-sub">
                {approval.approved ? "Aprobaste" : "Completaste"} el curso <strong>{courseTitle}</strong> de {partnerName}{" "}
                en Hidden Security.
            </p>

            {scoreLabel && (
                <div className="xs-completion-score">
                    <span className="xs-completion-date-label">// NOTA ({basisLabel.toUpperCase()})</span>
                    <span className="xs-completion-score-value">{scoreLabel}</span>
                </div>
            )}

            {start && end && (
                <>
                    <div className="xs-completion-dates">
                        <div className="xs-completion-date-item">
                            <span className="xs-completion-date-label">// INICIO</span>
                            <span className="xs-completion-date-value">{fmt(start)}</span>
                        </div>
                        <div className="xs-completion-date-sep">→</div>
                        <div className="xs-completion-date-item">
                            <span className="xs-completion-date-label">// FINALIZACIÓN</span>
                            <span className="xs-completion-date-value">{fmt(end)}</span>
                        </div>
                    </div>
                    <p className="xs-completion-duration">
                        Duración total: <strong>{duration}</strong>
                    </p>
                </>
            )}

            {/* ── Certificado ── */}
            {approval.approved && cert && cert.hasHolderName && certPath && (
                <div className="xs-completion-msg">
                    <p>
                        Tu certificado ya está disponible. Es público y verificable: podés compartirlo, descargarlo o
                        sumarlo a LinkedIn. El curso y sus skills validadas ya figuran en tu CV.
                    </p>
                    <button className="xs-btn xs-btn--accent xs-btn--lg" onClick={() => navigate(certPath)}>
                        VER MI CERTIFICADO →
                    </button>
                </div>
            )}

            {approval.approved && cert && !cert.hasHolderName && (
                <form className="xs-name-form" onSubmit={saveName}>
                    <span className="xs-eyebrow">// DATOS_DEL_CERTIFICADO</span>
                    <p className="xs-name-form-text">
                        Para emitir tu certificado necesitamos tu nombre y apellido tal como querés que aparezcan.
                        También se guardan en tu CV.
                    </p>
                    <div className="xs-name-form-row">
                        <label className="xs-field">
                            <span>Nombre</span>
                            <input
                                className="xs-input"
                                value={firstName}
                                maxLength={60}
                                autoComplete="given-name"
                                onChange={(e) => setFirstName(e.target.value)}
                                disabled={saving}
                            />
                        </label>
                        <label className="xs-field">
                            <span>Apellido</span>
                            <input
                                className="xs-input"
                                value={lastName}
                                maxLength={60}
                                autoComplete="family-name"
                                onChange={(e) => setLastName(e.target.value)}
                                disabled={saving}
                            />
                        </label>
                    </div>
                    {formError && <p className="xs-quiz-error">{formError}</p>}
                    <button type="submit" className="xs-btn xs-btn--accent xs-btn--lg" disabled={!validName || saving}>
                        {saving ? "GENERANDO..." : "GENERAR CERTIFICADO"}
                    </button>
                </form>
            )}

            {approval.approved && !cert && (
                <div className="xs-completion-msg">
                    <p>Estamos generando tu certificado. Si no aparece en unos segundos, actualizá.</p>
                    <button className="xs-btn xs-btn--ghost" onClick={() => onRefresh()} disabled={busy}>
                        {busy ? "ACTUALIZANDO..." : "↻ ACTUALIZAR"}
                    </button>
                </div>
            )}

            {!approval.approved && (
                <div className="xs-completion-msg">
                    <p>
                        {approval.basis === "FINAL_EXAM"
                            ? `Para aprobar el curso necesitás ${Math.round(approval.minScore * 100)}% o más en el examen final.`
                            : `Para aprobar el curso, cada evaluación necesita ${Math.round(approval.minScore * 100)}% o más (no alcanza con el promedio).`}{" "}
                        Podés rendirlas las veces que quieras: siempre se guarda tu mejor nota.
                    </p>
                    {approval.pending.length > 0 && (
                        <div className="xs-pending">
                            <span className="xs-completion-date-label">// TE FALTA LLEGAR AL {Math.round(approval.minScore * 100)}% EN</span>
                            {approval.pending.map((p) => (
                                <button key={p.stepId} className="xs-pending-item" onClick={() => onGoToStep(p.stepId)}>
                                    <span>{p.title}</span>
                                    <strong>{Math.round(p.bestScore * 100)}%</strong>
                                    <em>REINTENTAR →</em>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <button className="xs-btn xs-btn--ghost" onClick={onReview}>
                {approval.approved ? "VOLVER A VER EL CURSO" : "VOLVER AL CURSO"}
            </button>
        </div>
    );
}

const Dots = () => (
    <div className="xs-loading">
        <span className="xs-loading-dot" />
        <span className="xs-loading-dot" />
        <span className="xs-loading-dot" />
    </div>
);

// ══════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
const ExternalCoursePlayer = () => {
    const { partnerSlug, courseSlug } = useParams();
    const navigate = useNavigate();
    const { theme } = UseTheme();
    const course = useExternalCourse(partnerSlug, courseSlug);
    const { structure, progress, steps, loading, error, busy } = course;

    const branding = getPartnerBranding(partnerSlug);
    const cover = getCourseCover(partnerSlug, courseSlug);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [actionError, setActionError] = useState<string | null>(null);
    const [showIntro, setShowIntro] = useState(true);
    // Con el curso terminado, el alumno puede volver a entrar a repasar o a reintentar
    const [reviewing, setReviewing] = useState(false);

    const stageRef = useRef<HTMLDivElement>(null);

    // stepId → moduleId
    const moduleOf = useMemo(() => {
        const map = new Map<string, string>();
        structure?.modules.forEach((m) => m.steps.forEach((s) => map.set(s.stepId, m.moduleId)));
        return map;
    }, [structure]);

    // Al cargar: abrir el step donde quedó el alumno
    useEffect(() => {
        if (!progress?.started || !steps.length || selectedId) return;
        setSelectedId(progress.currentStepId ?? steps[steps.length - 1].stepId);
    }, [progress, steps, selectedId]);

    // El módulo del step activo siempre desplegado
    useEffect(() => {
        if (!selectedId) return;
        const mod = moduleOf.get(selectedId);
        if (!mod) return;
        setExpanded((prev) => (prev.has(mod) ? prev : new Set(prev).add(mod)));
    }, [selectedId, moduleOf]);

    // Scroll al top del contenido al cambiar de step
    useEffect(() => {
        stageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        setActionError(null);
    }, [selectedId]);

    const toggleModule = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const wrapClass = `xs-wrap ${theme}`;

    // ─── Cargando ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className={wrapClass}>
                <Dots />
            </div>
        );
    }

    // ─── Error / sin acceso ──────────────────────────────────────────
    if (error || !structure || !progress) {
        const notFound = error?.status === 404;
        const noAccess = error?.status === 403;
        return (
            <div className={wrapClass}>
                <div className="xs-blocked">
                    <span className="xs-blocked-icon">{notFound ? "⚠" : "🔒"}</span>
                    <span className="xs-blocked-eyebrow">
                        {notFound ? "// CURSO_NO_ENCONTRADO" : "// ACCESO_RESTRINGIDO"}
                    </span>
                    <h2 className="xs-blocked-title">
                        {notFound ? "Curso no encontrado" : noAccess ? "Membresía requerida" : "No se pudo cargar"}
                    </h2>
                    {error?.message && <p className="xs-blocked-msg">{error.message}</p>}
                    {noAccess ? (
                        <a href="/pricing" className="xs-btn xs-btn--accent xs-btn--lg">
                            COMPRAR MEMBRESÍA
                        </a>
                    ) : (
                        <button className="xs-btn xs-btn--ghost" onClick={() => navigate(-1)}>
                            ← VOLVER
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const info = structure.course;
    const partnerName = branding?.name || structure.partner.name;
    const partnerLogo = branding?.logo || structure.partner.logoUrl || null;
    const eyebrow = toEyebrow(info.title);

    // ─── Curso completado ────────────────────────────────────────────
    if (progress.isCompleted && !reviewing) {
        return (
            <div className={wrapClass}>
                <CompletionScreen
                    courseTitle={info.title}
                    partnerName={partnerName}
                    startedAt={progress.startedAt}
                    completedAt={progress.completedAt}
                    approval={progress.approval}
                    busy={busy}
                    onReview={() => setReviewing(true)}
                    onGoToStep={(stepId) => {
                        setSelectedId(stepId);
                        setReviewing(true);
                    }}
                    onRefresh={course.refreshProgress}
                />
            </div>
        );
    }

    // ─── Pantalla introductoria (antes de empezar) ───────────────────
    if (!progress.started || (showIntro && progress.completedStepsCount === 0)) {
        const count = (types: StepType[]) => steps.filter((s) => types.includes(s.type)).length;
        const minPass = steps.find((s) => s.quiz)?.quiz?.passScore;
        const duration = formatDuration(info.estimatedDurationMinutes);

        const handleStart = async () => {
            setActionError(null);
            try {
                if (!progress.started) await course.start();
                setShowIntro(false);
            } catch (err) {
                setActionError(apiErrorMessage(err));
            }
        };

        return (
            <div className={wrapClass}>
                <div className="xs-intro-page">
                    {cover && <img className="xs-intro-cover" src={cover} alt="" />}

                    <div className="xs-partner">
                        {partnerLogo && <img src={partnerLogo} alt="" />}
                        <span>CURSO DE {partnerName.toUpperCase()}</span>
                    </div>

                    <span className="xs-eyebrow">{eyebrow}</span>
                    <h1 className="xs-intro-title">{info.title}</h1>
                    {info.description && <p className="xs-intro-desc">{info.description}</p>}

                    {info.status === "DRAFT" && <span className="xs-draft">BORRADOR · SOLO ADMIN</span>}

                    <div className="xs-intro-details">
                        <div className="xs-intro-detail-item">
                            <span className="xs-intro-detail-label">// MÓDULOS</span>
                            <span className="xs-intro-detail-value">{info.moduleCount}</span>
                        </div>
                        {count(["VIDEO"]) > 0 && (
                            <div className="xs-intro-detail-item">
                                <span className="xs-intro-detail-label">// VIDEOS</span>
                                <span className="xs-intro-detail-value">{count(["VIDEO"])}</span>
                            </div>
                        )}
                        <div className="xs-intro-detail-item">
                            <span className="xs-intro-detail-label">// PDFs</span>
                            <span className="xs-intro-detail-value">{count(["CONTENT"])}</span>
                        </div>
                        <div className="xs-intro-detail-item">
                            <span className="xs-intro-detail-label">// QUIZZES</span>
                            <span className="xs-intro-detail-value">{count(["QUIZ", "FINAL_EXAM"])}</span>
                        </div>
                        {minPass != null && (
                            <div className="xs-intro-detail-item">
                                <span className="xs-intro-detail-label">// APROBACIÓN</span>
                                <span className="xs-intro-detail-value">{Math.round(minPass * 100)}%</span>
                            </div>
                        )}
                        {duration && (
                            <div className="xs-intro-detail-item">
                                <span className="xs-intro-detail-label">// DURACIÓN</span>
                                <span className="xs-intro-detail-value">{duration}</span>
                            </div>
                        )}
                    </div>

                    {actionError && <p className="xs-quiz-error">{actionError}</p>}

                    <button className="xs-btn xs-btn--accent xs-btn--lg" onClick={handleStart} disabled={busy}>
                        {busy ? "CARGANDO..." : progress.started ? "CONTINUAR CURSO →" : "COMENZAR CURSO →"}
                    </button>
                </div>
            </div>
        );
    }

    // ─── Vista principal del curso ───────────────────────────────────
    const selected = steps.find((s) => s.stepId === selectedId) ?? steps[0];
    const selectedIndex = steps.indexOf(selected);
    const prevStep = selectedIndex > 0 ? steps[selectedIndex - 1] : null;
    const nextStep = selectedIndex < steps.length - 1 ? steps[selectedIndex + 1] : null;
    const isQuiz = selected.type === "QUIZ" || selected.type === "FINAL_EXAM";
    const selectedDone = course.isStepCompleted(selected.stepId);
    const quizPassed = !!progress.quizResults[selected.stepId]?.passed;

    const goTo = (step: CourseStep) => {
        if (course.isStepUnlocked(step)) setSelectedId(step.stepId);
    };

    // PDF / video: se marca como completado al avanzar (igual que Soc1Course)
    const handleNext = async () => {
        if (busy) return;
        setActionError(null);
        try {
            if (!selectedDone) await course.completeStep(selected.stepId);
            if (nextStep) setSelectedId(nextStep.stepId);
        } catch (err) {
            setActionError(apiErrorMessage(err));
        }
    };

    const renderStep = () => {
        if (selected.type === "CONTENT") {
            return (
                <PdfStep
                    key={selected.stepId}
                    partnerSlug={course.partnerSlug}
                    courseSlug={course.courseSlug}
                    step={selected}
                    theme={theme}
                />
            );
        }
        if (selected.type === "VIDEO") {
            return <VideoStep key={selected.stepId} step={selected} />;
        }
        return (
            <QuizStep
                key={selected.stepId}
                step={selected}
                result={progress.quizResults[selected.stepId]}
                busy={busy}
                onSubmit={course.submitQuiz}
            />
        );
    };

    return (
        <div className={wrapClass}>
            {/* Header global */}
            <div className="xs-header">
                <div>
                    <div className="xs-partner xs-partner--sm">
                        {partnerLogo && <img src={partnerLogo} alt="" />}
                        <span>{partnerName.toUpperCase()}</span>
                    </div>
                    <span className="xs-eyebrow">{eyebrow}</span>
                    <h2 className="xs-header-title">{selected.title}</h2>
                </div>
                <ProgressBar
                    completed={progress.completedStepsCount}
                    total={progress.totalSteps}
                    pct={progress.progressPercentage}
                />
                {info.description && <p className="xs-header-desc">{info.description}</p>}
            </div>

            {progress.isCompleted && (
                <div className={`xs-result-banner${progress.approval.approved ? "" : " xs-result-banner--pending"}`}>
                    <span>
                        {progress.approval.approved ? "✓ CURSO APROBADO" : "CURSO COMPLETADO"}
                        {progress.approval.score != null && ` · NOTA ${Math.round(progress.approval.score * 100)}%`}
                        <small> · Podés repasar y reintentar las evaluaciones: se guarda siempre tu mejor nota.</small>
                    </span>
                    <button className="xs-btn xs-btn--ghost" onClick={() => setReviewing(false)}>
                        VER RESULTADO{progress.approval.approved ? " Y CERTIFICADO" : ""}
                    </button>
                </div>
            )}

            <div className="xs-modules">
                {structure.modules.map((mod) => {
                    const isExpanded = expanded.has(mod.moduleId);
                    const doneInMod = mod.steps.filter((s) => course.isStepCompleted(s.stepId)).length;
                    const moduleDone = doneInMod === mod.steps.length;
                    const hasActive = mod.steps.some((s) => s.stepId === selected.stepId);

                    return (
                        <div
                            key={mod.moduleId}
                            className={`xs-module${isExpanded ? " expanded" : ""}${moduleDone ? " done" : ""}`}
                        >
                            <button className="xs-module-header" onClick={() => toggleModule(mod.moduleId)}>
                                <span className="xs-module-icon">{moduleDone ? "✓" : "▣"}</span>
                                <span className="xs-module-title">{mod.title}</span>
                                <span className="xs-module-meta">
                                    {doneInMod}/{mod.steps.length}
                                </span>
                                <span className="xs-module-chevron">{isExpanded ? "▲" : "▼"}</span>
                            </button>

                            {isExpanded && (
                                <div className="xs-module-body">
                                    <aside className="xs-module-aside">
                                        <p className="xs-module-aside-title">// CONTENIDO</p>
                                        <ul className="xs-module-aside-list">
                                            {mod.steps.map((s) => {
                                                const done = course.isStepCompleted(s.stepId);
                                                const locked = !course.isStepUnlocked(s);
                                                const active = s.stepId === selected.stepId;
                                                return (
                                                    <li
                                                        key={s.stepId}
                                                        className={`xs-module-aside-item${active ? " active" : ""}${
                                                            done ? " done" : ""
                                                        }${locked ? " locked" : ""}`}
                                                        onClick={() => !locked && goTo(s)}
                                                        title={
                                                            locked
                                                                ? "Completá la etapa anterior para desbloquear"
                                                                : s.title
                                                        }
                                                    >
                                                        <span className="xs-module-aside-icon">
                                                            {done ? "✓" : STEP_ICONS[s.type]}
                                                        </span>
                                                        <span className="xs-module-aside-label">
                                                            {s.title}
                                                            {!s.required && " · opcional"}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </aside>

                                    <div className="xs-module-stage" ref={hasActive ? stageRef : undefined}>
                                        {hasActive ? (
                                            <>
                                                {renderStep()}

                                                {actionError && <p className="xs-quiz-error">{actionError}</p>}

                                                <div className="xs-nav">
                                                    {prevStep && (
                                                        <button
                                                            className="xs-btn xs-btn--ghost"
                                                            onClick={() => goTo(prevStep)}
                                                        >
                                                            ← ANTERIOR
                                                        </button>
                                                    )}

                                                    {!isQuiz && nextStep && (
                                                        <button
                                                            className="xs-btn xs-btn--accent"
                                                            onClick={handleNext}
                                                            disabled={busy}
                                                        >
                                                            {busy ? "GUARDANDO..." : "SIGUIENTE →"}
                                                        </button>
                                                    )}

                                                    {!isQuiz && !nextStep && (
                                                        <button
                                                            className="xs-btn xs-btn--accent xs-btn--lg"
                                                            onClick={handleNext}
                                                            disabled={busy}
                                                        >
                                                            {busy ? "GUARDANDO..." : "FINALIZAR CURSO ✓"}
                                                        </button>
                                                    )}

                                                    {isQuiz && quizPassed && nextStep && (
                                                        <button
                                                            className="xs-btn xs-btn--accent"
                                                            onClick={() => goTo(nextStep)}
                                                        >
                                                            SIGUIENTE →
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="xs-module-placeholder">
                                                <p>Seleccioná un contenido del módulo para visualizarlo.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ExternalCoursePlayer;