import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { externalCoursesApi, apiErrorStatus, type CourseStep } from "../api/externalCoursesApi";

// Worker de PDF.js — la misma línea que Soc1Course.tsx
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

interface Props {
    partnerSlug: string;
    courseSlug: string;
    step: CourseStep;
    theme: string;
}

// Mismo visor que Soc1Course (PdfViewer), con el PDF pedido al backend por stepId.
// Un único <Document>; la <Page> se dibuja inline o dentro del overlay de
// pantalla completa vía portal.
//
// Protección de contenido:
//  - sin capa de texto ni de anotaciones → no hay texto en el DOM para copiar
//  - sin visor del navegador → sin botón de descargar ni imprimir
//  - sin links al archivo, click derecho / arrastre / copiar bloqueados
//  - Ctrl/Cmd + S y Ctrl/Cmd + P bloqueados mientras el visor está montado
//  - @media print oculta el visor (ver CSS)

const PdfStep = ({ partnerSlug, courseSlug, step, theme }: Props) => {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [numPages, setNumPages] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [ratio, setRatio] = useState<number | null>(null);
    const [isFs, setIsFs] = useState(false);

    const wrapRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const touchX = useRef<number | null>(null);

    const [width, setWidth] = useState(0);
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

    const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
    const goNext = useCallback(() => setPage((p) => Math.min(numPages || 1, p + 1)), [numPages]);

    // ── Pedir el PDF al backend (cookie de sesión + acceso + step desbloqueado)
    useEffect(() => {
        let alive = true;
        let created: string | null = null;

        externalCoursesApi
            .pdfBlobUrl(partnerSlug, courseSlug, step.stepId)
            .then((blobUrl) => {
                created = blobUrl;
                if (alive) setUrl(blobUrl);
                else URL.revokeObjectURL(blobUrl);
            })
            .catch((err) => {
                if (!alive) return;
                setLoading(false);
                setError(
                    apiErrorStatus(err) === 409
                        ? "Completá los pasos anteriores para ver este contenido."
                        : "No se pudo cargar el PDF."
                );
            });

        return () => {
            alive = false;
            if (created) URL.revokeObjectURL(created);
        };
    }, [partnerSlug, courseSlug, step.stepId]);

    // ── Ancho del contenedor inline ────────────────────────────────────
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const obs = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
        obs.observe(el);
        setWidth(el.clientWidth);
        return () => obs.disconnect();
    }, []);

    // ── Tamaño del escenario en pantalla completa ──────────────────────
    useEffect(() => {
        if (!isFs) return;
        const el = stageRef.current;
        if (!el) return;
        const obs = new ResizeObserver(([entry]) => {
            setStageSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) });
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, [isFs]);

    // ── Pantalla completa ──────────────────────────────────────────────
    // Fullscreen nativo sobre <html> + overlay fijo. En iPhone, donde Safari
    // no soporta fullscreen de elementos, el overlay solo ya ocupa la pantalla.
    const openFs = () => {
        setIsFs(true);
        const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
        if (document.fullscreenElement) return;
        if (root.requestFullscreen) {
            root.requestFullscreen().catch(() => {
                /* el overlay igual funciona */
            });
        } else if (root.webkitRequestFullscreen) {
            root.webkitRequestFullscreen();
        }
    };

    const closeFs = useCallback(() => {
        setIsFs(false);
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    }, []);

    // Si el usuario sale del fullscreen nativo (Esc del navegador), cerramos el overlay
    useEffect(() => {
        const onChange = () => {
            if (!document.fullscreenElement) setIsFs(false);
        };
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    // Bloquear el scroll del body con el overlay abierto
    useEffect(() => {
        if (!isFs) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isFs]);

    // Al desmontar (cambio de step) salir del fullscreen nativo si quedó activo
    useEffect(
        () => () => {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        },
        []
    );

    // ── Teclado: flechas para paginar + bloqueo de guardar/imprimir ───
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
                return;

            const mod = e.ctrlKey || e.metaKey;
            if (mod && ["s", "p"].includes(e.key.toLowerCase())) {
                e.preventDefault();
                return;
            }
            if (mod || e.altKey || !numPages) return;

            const nextKeys = isFs ? ["ArrowRight", "ArrowDown", "PageDown", " "] : ["ArrowRight", "PageDown"];
            const prevKeys = isFs ? ["ArrowLeft", "ArrowUp", "PageUp"] : ["ArrowLeft", "PageUp"];

            if (nextKeys.includes(e.key)) {
                e.preventDefault();
                goNext();
            } else if (prevKeys.includes(e.key)) {
                e.preventDefault();
                goPrev();
            } else if (isFs && e.key === "Home") {
                e.preventDefault();
                setPage(1);
            } else if (isFs && e.key === "End") {
                e.preventDefault();
                setPage(numPages);
            } else if (isFs && e.key === "Escape") {
                e.preventDefault();
                closeFs();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [numPages, isFs, goNext, goPrev, closeFs]);

    // ── Swipe en mobile (pantalla completa) ───────────────────────────
    const onTouchStart = (e: React.TouchEvent) => {
        touchX.current = e.touches[0].clientX;
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < 50) return;
        if (dx < 0) goNext();
        else goPrev();
    };

    const blockEvent = (e: React.SyntheticEvent) => e.preventDefault();

    const onLoadSuccess = ({ numPages: n }: { numPages: number }) => {
        setNumPages(n);
        setLoading(false);
    };

    const onLoadError = () => {
        setLoading(false);
        setError("No se pudo cargar el PDF.");
    };

    // Proporción de la página para encajarla en pantalla completa
    const onPageLoad = (p: { getViewport: (o: { scale: number }) => { width: number; height: number } }) => {
        const vp = p.getViewport({ scale: 1 });
        if (vp.height > 0) setRatio(vp.width / vp.height);
    };

    // En pantalla completa la página entra entera: limita ancho o alto
    const fsWidth = (() => {
        if (!stageSize.w || !stageSize.h) return 0;
        if (!ratio) return stageSize.w;
        return Math.floor(Math.min(stageSize.w, stageSize.h * ratio));
    })();

    if (error) {
        return (
            <div className="xs-pdf-error">
                <span>{error}</span>
                <span style={{ fontSize: "0.72rem", opacity: 0.5 }}>Verificá tu conexión o tu membresía.</span>
            </div>
        );
    }

    const pagination = (variant: "inline" | "fs") => (
        <div className={`xs-pdf-pagination${variant === "fs" ? " xs-pdf-pagination--fs" : ""}`}>
            <button className="xs-pdf-page-btn" onClick={goPrev} disabled={page === 1} aria-label="Página anterior">
                ← ANTERIOR
            </button>
            <span className="xs-pdf-page-info">
                Página {page} / {numPages}
            </span>
            <button
                className="xs-pdf-page-btn"
                onClick={goNext}
                disabled={page === numPages}
                aria-label="Página siguiente"
            >
                SIGUIENTE →
            </button>
        </div>
    );

    return (
        <div
            className="xs-pdf-wrap xs-protected"
            onContextMenu={blockEvent}
            onCopy={blockEvent}
            onCut={blockEvent}
            onDragStart={blockEvent}
        >
            <div
                className={`xs-pdf-canvas-container${loading ? " is-loading" : ""}${isFs ? " is-fs-open" : ""}`}
                ref={wrapRef}
            >
                {loading && (
                    <div className="xs-pdf-loading">
                        <span className="xs-loading-dot" />
                        <span className="xs-loading-dot" />
                        <span className="xs-loading-dot" />
                    </div>
                )}

                {url && (
                    <Document file={url} onLoadSuccess={onLoadSuccess} onLoadError={onLoadError} loading="">
                        {!isFs && width > 0 && (
                            <Page
                                pageNumber={page}
                                width={width}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                onLoadSuccess={onPageLoad}
                                loading=""
                            />
                        )}

                        {isFs &&
                            createPortal(
                                <div
                                    className={`xs-wrap ${theme} xs-pdf-fs xs-protected`}
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label={`${step.title} — pantalla completa`}
                                    onContextMenu={blockEvent}
                                    onCopy={blockEvent}
                                    onCut={blockEvent}
                                    onDragStart={blockEvent}
                                >
                                    <div className="xs-pdf-fs-top">
                                        <span className="xs-pdf-fs-title">{step.title}</span>
                                        <button
                                            className="xs-pdf-fs-close"
                                            onClick={closeFs}
                                            aria-label="Salir de pantalla completa"
                                        >
                                            ✕ <span className="xs-pdf-fs-close-label">SALIR</span>
                                        </button>
                                    </div>

                                    <div
                                        className="xs-pdf-fs-stage"
                                        ref={stageRef}
                                        onTouchStart={onTouchStart}
                                        onTouchEnd={onTouchEnd}
                                    >
                                        {fsWidth > 0 && (
                                            <Page
                                                pageNumber={page}
                                                width={fsWidth}
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                                onLoadSuccess={onPageLoad}
                                                loading=""
                                            />
                                        )}
                                    </div>

                                    {numPages > 0 && pagination("fs")}
                                    <p className="xs-pdf-fs-hint">
                                        Usá ← → del teclado para pasar de página · Esc para salir
                                    </p>
                                </div>,
                                document.body
                            )}
                    </Document>
                )}

                {isFs && <div className="xs-pdf-fs-placeholder">Leyendo en pantalla completa…</div>}
            </div>

            {numPages > 0 && (
                <div className="xs-pdf-toolbar">
                    {pagination("inline")}
                    <button className="xs-pdf-fs-btn" onClick={openFs} aria-label="Ver en pantalla completa">
                        ⛶ PANTALLA COMPLETA
                    </button>
                </div>
            )}
        </div>
    );
};

export default PdfStep;