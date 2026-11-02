import { useEffect, useState } from "react";
import {
    apiErrorMessage,
    type CourseStep,
    type QuizAnswers,
    type QuizQuestion,
    type QuizResult,
    type QuizSubmitResponse,
} from "../api/externalCoursesApi";

interface Props {
    step: CourseStep;
    result?: QuizResult;
    busy: boolean;
    onSubmit: (quizId: string, answers: QuizAnswers) => Promise<QuizSubmitResponse>;
}

// Mismo quiz que Soc1Course (QuizViewer). La corrección es 100% del backend:
// acá solo se eligen opciones y se muestra el resultado. El orden de las
// preguntas y el de las opciones se mezcla en cada intento.

// Fisher–Yates — mezcla sin sesgo y sin mutar el original
function shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const shuffleQuiz = (questions: QuizQuestion[]) =>
    shuffle(questions).map((q) => ({ ...q, options: shuffle(q.options) }));

const pct = (n: number) => `${Math.round(n * 100)}%`;

const QuizStep = ({ step, result, busy, onSubmit }: Props) => {
    const quiz = step.quiz!;

    const [questions, setQuestions] = useState<QuizQuestion[]>(() => shuffleQuiz(quiz.questions));
    const [answers, setAnswers] = useState<QuizAnswers>({});
    const [response, setResponse] = useState<QuizSubmitResponse | null>(null);
    const [submitErr, setSubmitErr] = useState("");
    const [showPrior, setShowPrior] = useState(!!result?.passed);

    useEffect(() => {
        setQuestions(shuffleQuiz(quiz.questions));
        setAnswers({});
        setResponse(null);
        setSubmitErr("");
        setShowPrior(!!result?.passed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step.stepId]);

    const attempts = response?.attempts ?? result?.attempts ?? 0;
    const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
    const allAnswered = questions.length > 0 && answeredCount === questions.length;
    const noAttemptsLeft =
        !result?.passed && !response?.passed && quiz.maxAttempts != null && attempts >= quiz.maxAttempts;

    const handleSelect = (questionId: string, optionId: string) => {
        if (response) return;
        setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    };

    const handleSubmit = async () => {
        if (!allAnswered || busy) return;
        setSubmitErr("");
        try {
            setResponse(await onSubmit(quiz.quizId, answers));
        } catch (err) {
            setSubmitErr(apiErrorMessage(err, "No se pudo enviar el quiz. Revisá tu conexión e intentá de nuevo."));
        }
    };

    // Cada reintento vuelve a mezclar preguntas y opciones
    const handleRetry = () => {
        setQuestions(shuffleQuiz(quiz.questions));
        setAnswers({});
        setResponse(null);
        setShowPrior(false);
        setSubmitErr("");
    };

    const chosenText = (q: QuizQuestion) => q.options.find((o) => o.id === answers[q.id])?.text ?? "—";

    // ─── Ya aprobado antes ───────────────────────────────────────────
    if (showPrior && result?.passed) {
        return (
            <div className="xs-quiz-result xs-quiz-result--passed">
                <span className="xs-quiz-result-icon">✓</span>
                <p className="xs-quiz-result-score">Aprobado con {pct(result.bestScore ?? result.score)}</p>
                <p className="xs-quiz-result-sub">
                    Intentos: {result.attempts} · Podés continuar al siguiente módulo.
                </p>
                <button className="xs-btn xs-btn--ghost" onClick={handleRetry}>
                    Reintentar de todas formas
                </button>
            </div>
        );
    }

    // ─── Sin intentos ────────────────────────────────────────────────
    if (noAttemptsLeft && !response) {
        return (
            <div className="xs-quiz-result xs-quiz-result--failed">
                <span className="xs-quiz-result-icon">✗</span>
                <p className="xs-quiz-result-score">SIN INTENTOS DISPONIBLES</p>
                <p className="xs-quiz-result-sub">
                    Usaste los {quiz.maxAttempts} intentos de esta evaluación. Contactá a soporte de Hidden Security.
                </p>
            </div>
        );
    }

    // ─── Resultado del intento ───────────────────────────────────────
    if (response) {
        const passed = response.passed;
        const canRetry = !passed && (response.attemptsLeft == null || response.attemptsLeft > 0);
        return (
            <div className={`xs-quiz-result${passed ? " xs-quiz-result--passed" : " xs-quiz-result--failed"}`}>
                <span className="xs-quiz-result-icon">{passed ? "✓" : "✗"}</span>
                <p className="xs-quiz-result-score">
                    {pct(response.score)} — {passed ? "APROBADO" : "NO APROBADO"}
                </p>
                <p className="xs-quiz-result-sub">
                    {passed
                        ? "¡Excelente! Podés continuar al siguiente módulo."
                        : `Necesitás al menos ${pct(quiz.passScore)} para aprobar. Intentá de nuevo.`}
                </p>
                <p className="xs-quiz-attempts">
                    Intento #{attempts}
                    {response.correctCount != null && response.total != null &&
                        ` · ${response.correctCount}/${response.total} correctas`}
                    {!passed && response.attemptsLeft != null && ` · Te quedan ${response.attemptsLeft} intentos`}
                </p>

                {/* Revisión — muestra lo elegido, nunca la correcta (vive en el backend) */}
                <div className="xs-quiz-review">
                    {questions.map((q, i) => (
                        <div key={q.id} className="xs-quiz-review-item">
                            <p className="xs-quiz-review-q">
                                {i + 1}. {q.text}
                            </p>
                            <p className="xs-quiz-review-a">
                                Tu respuesta: <strong>{chosenText(q)}</strong>
                            </p>
                        </div>
                    ))}
                </div>

                {canRetry && (
                    <button className="xs-btn xs-btn--accent" onClick={handleRetry}>
                        REINTENTAR
                    </button>
                )}
            </div>
        );
    }

    // ─── Formulario ──────────────────────────────────────────────────
    return (
        <div className="xs-quiz-wrap xs-protected" onCopy={(e) => e.preventDefault()}>
            <p className="xs-quiz-subtitle">
                Respondé todas las preguntas para aprobar. Mínimo {pct(quiz.passScore)}.
                {attempts > 0 && <span className="xs-quiz-attempts"> · Intentos anteriores: {attempts}</span>}
                {quiz.maxAttempts != null && (
                    <span className="xs-quiz-attempts"> · Máximo {quiz.maxAttempts} intentos</span>
                )}
            </p>

            {questions.map((q, qIdx) => (
                <div key={q.id} className="xs-quiz-question">
                    <p className="xs-quiz-q-text">
                        {qIdx + 1}. {q.text}
                    </p>

                    <div className="xs-quiz-options">
                        {q.options.map((opt, aIdx) => (
                            <button
                                key={opt.id}
                                type="button"
                                className={`xs-quiz-option${answers[q.id] === opt.id ? " selected" : ""}`}
                                onClick={() => handleSelect(q.id, opt.id)}
                                disabled={busy}
                            >
                                <span className="xs-quiz-option-letter">{String.fromCharCode(65 + aIdx)}</span>
                                {opt.text}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {submitErr && <p className="xs-quiz-error">{submitErr}</p>}

            <button className="xs-btn xs-btn--accent" onClick={handleSubmit} disabled={!allAnswered || busy}>
                {busy ? "ENVIANDO..." : `ENVIAR RESPUESTAS (${answeredCount}/${questions.length})`}
            </button>
        </div>
    );
};

export default QuizStep;