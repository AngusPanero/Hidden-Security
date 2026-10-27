import { useEffect, useState } from "react";
import { Award, CheckCircle2, Loader2, RotateCcw, XCircle, ChevronRight, AlertTriangle } from "lucide-react";
import {
    apiErrorMessage,
    type CourseStep,
    type QuizAnswers,
    type QuizResult,
    type QuizSubmitResponse,
} from "../api/externalCoursesApi";

interface Props {
    step: CourseStep;
    result?: QuizResult;
    busy: boolean;
    hasNext: boolean;
    onSubmit: (quizId: string, answers: QuizAnswers) => Promise<QuizSubmitResponse>;
    onContinue: () => void;
}

// Quiz y examen final. La corrección es 100% del backend:
// acá solo se eligen opciones y se muestra el resultado.

const pct = (n: number) => `${Math.round(n * 100)}%`;

const QuizStep = ({ step, result, busy, hasNext, onSubmit, onContinue }: Props) => {
    const quiz = step.quiz!;
    const isFinal = step.type === "FINAL_EXAM";

    const [answers, setAnswers] = useState<QuizAnswers>({});
    const [response, setResponse] = useState<QuizSubmitResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setAnswers({});
        setResponse(null);
        setError(null);
    }, [step.stepId]);

    const attemptsUsed = response?.attempts ?? result?.attempts ?? 0;
    const passed = response?.passed || result?.passed || false;
    const noAttemptsLeft =
        !passed && quiz.maxAttempts != null && attemptsUsed >= quiz.maxAttempts;
    const allAnswered = quiz.questions.every((q) => answers[q.id]);

    const handleSubmit = async () => {
        setError(null);
        try {
            const r = await onSubmit(quiz.quizId, answers);
            setResponse(r);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    const retry = () => {
        setAnswers({});
        setResponse(null);
        setError(null);
    };

    // ─── Aprobado ────────────────────────────────────────────────────
    if (passed) {
        const score = response ? response.score : result?.bestScore ?? 0;
        return (
            <div className="xc-step xc-step--quiz">
                <div className="xc-result xc-result--pass">
                    <Award size={34} />
                    <h3>{isFinal ? "EVALUACIÓN FINAL APROBADA" : "EVALUACIÓN APROBADA"}</h3>
                    <p className="xc-result-score">{pct(score)}</p>
                    <p className="xc-result-meta">
                        Mínimo para aprobar: {pct(quiz.passScore)} · Intentos: {attemptsUsed}
                    </p>
                    {hasNext && (
                        <button className="xc-btn xc-btn--primary" onClick={onContinue}>
                            CONTINUAR
                            <ChevronRight size={16} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ─── Sin intentos ────────────────────────────────────────────────
    if (noAttemptsLeft) {
        return (
            <div className="xc-step xc-step--quiz">
                <div className="xc-result xc-result--fail">
                    <XCircle size={34} />
                    <h3>SIN INTENTOS DISPONIBLES</h3>
                    <p className="xc-result-meta">
                        Usaste los {quiz.maxAttempts} intentos de esta evaluación. Contactá a soporte de Hidden
                        Security.
                    </p>
                </div>
            </div>
        );
    }

    // ─── Desaprobado (recién enviado) ────────────────────────────────
    if (response && !response.passed) {
        return (
            <div className="xc-step xc-step--quiz">
                <div className="xc-result xc-result--fail">
                    <XCircle size={34} />
                    <h3>NO ALCANZASTE EL MÍNIMO</h3>
                    <p className="xc-result-score">{pct(response.score)}</p>
                    <p className="xc-result-meta">
                        {response.correctCount}/{response.total} correctas · Mínimo: {pct(quiz.passScore)}
                        {response.attemptsLeft != null && ` · Te quedan ${response.attemptsLeft} intentos`}
                    </p>
                    {(response.attemptsLeft == null || response.attemptsLeft > 0) && (
                        <button className="xc-btn xc-btn--primary" onClick={retry}>
                            <RotateCcw size={16} />
                            REINTENTAR
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ─── Formulario ──────────────────────────────────────────────────
    return (
        <div className="xc-step xc-step--quiz">
            <div className="xc-quiz-info">
                <span>{quiz.questionCount} PREGUNTAS</span>
                <span>APROBÁS CON {pct(quiz.passScore)}</span>
                <span>
                    {quiz.maxAttempts != null
                        ? `INTENTO ${attemptsUsed + 1} DE ${quiz.maxAttempts}`
                        : `INTENTOS: ${attemptsUsed}`}
                </span>
            </div>

            <ol className="xc-questions">
                {quiz.questions.map((q, qi) => (
                    <li key={q.id} className="xc-question">
                        <p className="xc-question-text">
                            <span className="xc-question-num">{String(qi + 1).padStart(2, "0")}</span>
                            {q.text}
                        </p>
                        <div className="xc-options">
                            {q.options.map((o) => {
                                const selected = answers[q.id] === o.id;
                                return (
                                    <button
                                        key={o.id}
                                        type="button"
                                        className={`xc-option${selected ? " xc-option--selected" : ""}`}
                                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                                        disabled={busy}
                                    >
                                        <span className="xc-option-dot" />
                                        {o.text}
                                    </button>
                                );
                            })}
                        </div>
                    </li>
                ))}
            </ol>

            {error && (
                <div className="xc-alert">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            <div className="xc-step-actions">
                <span className="xc-muted">
                    {Object.keys(answers).length}/{quiz.questionCount} respondidas
                </span>
                <button
                    className="xc-btn xc-btn--primary"
                    onClick={handleSubmit}
                    disabled={!allAnswered || busy}
                >
                    {busy ? <Loader2 className="xc-spin" size={16} /> : <CheckCircle2 size={16} />}
                    ENVIAR RESPUESTAS
                </button>
            </div>
        </div>
    );
};

export default QuizStep;