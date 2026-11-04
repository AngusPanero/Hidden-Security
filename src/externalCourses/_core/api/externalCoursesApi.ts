import axios from "axios";

// ─────────────────────────────────────────────────────────────────────
// Todas las llamadas al router /api/external-courses del backend.
// Las respuestas correctas de los quiz y las rutas de los PDF nunca
// llegan al front: el PDF se pide por stepId y vuelve como blob.
// ─────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL;
const BASE = `${API_URL}/api/external-courses`;

const http = axios.create({ withCredentials: true });

// ─── Tipos ───────────────────────────────────────────────────────────
export type StepType = "CONTENT" | "VIDEO" | "QUIZ" | "FINAL_EXAM";

export interface QuizOption {
    id: string;
    text: string;
}

export interface QuizQuestion {
    id: string;
    text: string;
    options: QuizOption[];
}

export interface QuizInfo {
    quizId: string;
    title: string;
    passScore: number;
    maxAttempts: number | null;
    questionCount: number;
    questions: QuizQuestion[];
}

export interface CourseStep {
    stepId: string;
    stepIndex: number;
    type: StepType;
    title: string;
    required: boolean;
    progressEligible: boolean;
    durationMinutes: number | null;
    hasFile?: boolean;
    url?: string;
    quiz?: QuizInfo;
}

export interface CourseModule {
    moduleId: string;
    title: string;
    description: string;
    steps: CourseStep[];
}

export interface CourseStructure {
    partner: { slug: string; name: string; logoUrl: string };
    course: {
        courseId: string;
        slug: string;
        version: number;
        title: string;
        description: string;
        status: "ACTIVE" | "DRAFT" | "INACTIVE";
        estimatedDurationMinutes: number | null;
        sequential: boolean;
        hasFinalExam: boolean;
        minPassScore: number; // 0.8: mínimo para aprobar cada evaluación y el curso
        moduleCount: number;
        totalSteps: number;
        totalEligibleSteps: number;
    };
    modules: CourseModule[];
}

export interface QuizResult {
    score: number;
    bestScore: number;
    passed: boolean;
    attempts: number;
    lastAttemptAt: string | null;
    passedAt: string | null;
}

// Aprobación del curso (la decide el backend). Con examen final cuenta su
// mejor nota; sin examen final, todas las evaluaciones aprobadas.
export interface CourseCertificate {
    credentialId: string;
    url: string;
    hasHolderName: boolean; // false → falta nombre y apellido en el CV
}

export interface CourseApproval {
    completed: boolean;
    approved: boolean;
    score: number | null;
    basis: "FINAL_EXAM" | "ALL_QUIZZES";
    minScore: number;
    // Evaluaciones que no llegan al mínimo (la nota guardada es la mejor)
    pending: { stepId: string; title: string; bestScore: number }[];
    certificate: CourseCertificate | null;
}

export interface CourseProgress {
    started: boolean;
    courseId: string;
    courseVersion: number;
    startedAt: string | null;
    completedStepIds: string[];
    completedStepsCount: number;
    completedEligibleCount: number;
    totalEligibleSteps: number;
    progressPercentage: number;
    currentStepId: string | null;
    currentStepIndex: number;
    totalSteps: number;
    quizResults: Record<string, QuizResult>;
    isCompleted: boolean;
    completedAt: string | null;
    approval: CourseApproval;
}

export interface QuizSubmitResponse {
    passed: boolean;        // este intento llegó al mínimo
    alreadyPassed: boolean; // ya estaba aprobada antes (es un reintento)
    score: number;          // nota de este intento
    bestScore: number;      // mejor nota guardada (nunca baja)
    correctCount?: number;
    total?: number;
    passScore?: number;
    attempts: number;
    attemptsLeft: number | null;
    courseApproval: CourseApproval;
    progress: CourseProgress;
}

// Nombre y apellido del CV (para el titular del certificado)
export interface CvPersonalInfo {
    firstName?: string;
    lastName?: string;
    [key: string]: unknown;
}

export interface CatalogCourse {
    partnerSlug: string;
    partnerName: string;
    partnerLogoUrl: string;
    courseSlug: string;
    courseId: string;
    title: string;
    description: string;
    estimatedDurationMinutes: number | null;
    moduleCount: number;
    totalSteps: number;
}

export type QuizAnswers = Record<string, string>; // { [questionId]: optionId }

// ─── Llamadas ────────────────────────────────────────────────────────
const coursePath = (partnerSlug: string, courseSlug: string) =>
    `${BASE}/${encodeURIComponent(partnerSlug)}/${encodeURIComponent(courseSlug)}`;

export const externalCoursesApi = {
    async catalog(): Promise<CatalogCourse[]> {
        const { data } = await http.get<{ courses: CatalogCourse[] }>(BASE);
        return data.courses;
    },

    async structure(partnerSlug: string, courseSlug: string): Promise<CourseStructure> {
        const { data } = await http.get<CourseStructure>(`${coursePath(partnerSlug, courseSlug)}/structure`);
        return data;
    },

    async progress(partnerSlug: string, courseSlug: string): Promise<CourseProgress> {
        const { data } = await http.get<CourseProgress>(`${coursePath(partnerSlug, courseSlug)}/progress`);
        return data;
    },

    async start(partnerSlug: string, courseSlug: string): Promise<CourseProgress> {
        const { data } = await http.post<CourseProgress>(`${coursePath(partnerSlug, courseSlug)}/start`);
        return data;
    },

    async completeStep(partnerSlug: string, courseSlug: string, stepId: string): Promise<CourseProgress> {
        const { data } = await http.post<CourseProgress>(
            `${coursePath(partnerSlug, courseSlug)}/steps/${encodeURIComponent(stepId)}/complete`
        );
        return data;
    },

    async submitQuiz(
        partnerSlug: string,
        courseSlug: string,
        quizId: string,
        answers: QuizAnswers
    ): Promise<QuizSubmitResponse> {
        const { data } = await http.post<QuizSubmitResponse>(
            `${coursePath(partnerSlug, courseSlug)}/quiz/${encodeURIComponent(quizId)}/submit`,
            { answers }
        );
        return data;
    },

    // ── CV (rutas existentes del back: GET y PUT /api/cv/me) ─────────
    async myPersonalInfo(): Promise<CvPersonalInfo> {
        const { data } = await http.get<{ data: { personalInfo?: CvPersonalInfo } | null }>(`${API_URL}/api/cv/me`);
        return data.data?.personalInfo ?? {};
    },

    // Guarda nombre y apellido conservando el resto de los datos personales
    // (PUT /api/cv/me reemplaza personalInfo entero, por eso se manda completo)
    async saveHolderName(firstName: string, lastName: string): Promise<void> {
        const current = await externalCoursesApi.myPersonalInfo();
        await http.put(`${API_URL}/api/cv/me`, {
            personalInfo: { ...current, firstName, lastName },
        });
    },

    // Devuelve una URL blob: (hay que liberarla con URL.revokeObjectURL)
    async pdfBlobUrl(partnerSlug: string, courseSlug: string, stepId: string): Promise<string> {
        const res = await http.get<Blob>(
            `${coursePath(partnerSlug, courseSlug)}/content/${encodeURIComponent(stepId)}`,
            { responseType: "blob" }
        );
        return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    },
};

// ─── Errores ─────────────────────────────────────────────────────────
export function apiErrorStatus(err: unknown): number | null {
    return axios.isAxiosError(err) ? err.response?.status ?? null : null;
}

export function apiErrorMessage(err: unknown, fallback = "Ocurrió un error. Intentá de nuevo."): string {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        if (data && typeof data === "object" && !(data instanceof Blob)) {
            return data.error || data.message || fallback;
        }
    }
    return fallback;
}