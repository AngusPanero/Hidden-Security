import { useCallback, useEffect, useMemo, useState } from "react";
import {
    externalCoursesApi,
    apiErrorMessage,
    apiErrorStatus,
    type CourseProgress,
    type CourseStep,
    type CourseStructure,
    type QuizAnswers,
} from "../api/externalCoursesApi";

// Estado completo de un curso externo: estructura + progreso + acciones.
// El backend es el que valida todo; acá solo se refleja para la UI.

export interface CourseLoadError {
    status: number | null;
    message: string;
}

export function useExternalCourse(partnerSlug?: string, courseSlug?: string) {
    const [structure, setStructure] = useState<CourseStructure | null>(null);
    const [progress, setProgress] = useState<CourseProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<CourseLoadError | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!partnerSlug || !courseSlug) return;
        let alive = true;

        setLoading(true);
        setError(null);

        Promise.all([
            externalCoursesApi.structure(partnerSlug, courseSlug),
            externalCoursesApi.progress(partnerSlug, courseSlug),
        ])
            .then(([s, p]) => {
                if (!alive) return;
                setStructure(s);
                setProgress(p);
            })
            .catch((err) => {
                if (!alive) return;
                setError({
                    status: apiErrorStatus(err),
                    message: apiErrorMessage(err, "No se pudo cargar el curso"),
                });
            })
            .finally(() => alive && setLoading(false));

        return () => {
            alive = false;
        };
    }, [partnerSlug, courseSlug]);

    const steps = useMemo<CourseStep[]>(
        () => (structure ? structure.modules.flatMap((m) => m.steps) : []),
        [structure]
    );

    const completedSet = useMemo(() => new Set(progress?.completedStepIds ?? []), [progress]);

    const isStepCompleted = useCallback((stepId: string) => completedSet.has(stepId), [completedSet]);

    // Mismo criterio que el backend: en un curso secuencial, un step se
    // desbloquea cuando todos los steps required anteriores están completos.
    const isStepUnlocked = useCallback(
        (step: CourseStep) => {
            if (!structure?.course.sequential) return true;
            return steps.every(
                (s) => s.stepIndex >= step.stepIndex || !s.required || completedSet.has(s.stepId)
            );
        },
        [structure, steps, completedSet]
    );

    const withBusy = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
        setBusy(true);
        try {
            return await fn();
        } finally {
            setBusy(false);
        }
    }, []);

    const start = useCallback(
        () =>
            withBusy(async () => {
                const p = await externalCoursesApi.start(partnerSlug!, courseSlug!);
                setProgress(p);
                return p;
            }),
        [partnerSlug, courseSlug, withBusy]
    );

    const completeStep = useCallback(
        (stepId: string) =>
            withBusy(async () => {
                const p = await externalCoursesApi.completeStep(partnerSlug!, courseSlug!, stepId);
                setProgress(p);
                return p;
            }),
        [partnerSlug, courseSlug, withBusy]
    );

    const submitQuiz = useCallback(
        (quizId: string, answers: QuizAnswers) =>
            withBusy(async () => {
                const r = await externalCoursesApi.submitQuiz(partnerSlug!, courseSlug!, quizId, answers);
                setProgress(r.progress);
                return r;
            }),
        [partnerSlug, courseSlug, withBusy]
    );

    return {
        partnerSlug: partnerSlug ?? "",
        courseSlug: courseSlug ?? "",
        structure,
        progress,
        steps,
        loading,
        error,
        busy,
        isStepCompleted,
        isStepUnlocked,
        start,
        completeStep,
        submitQuiz,
    };
}

export type ExternalCourseState = ReturnType<typeof useExternalCourse>;