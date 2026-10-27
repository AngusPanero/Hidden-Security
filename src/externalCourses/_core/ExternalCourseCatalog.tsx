import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Clock, Layers, Loader2 } from "lucide-react";
import { externalCoursesApi, type CatalogCourse } from "./api/externalCoursesApi";
import { getCourseCover, getCoursePath, getPartnerBranding } from "./registry";
import "./externalCourses.css";
import { UseTheme } from "../../contexts/ThemeContext";

// Listado de cursos de partners (solo los ACTIVE).
// Se puede usar como página o embebido en el dashboard:
//   <ExternalCourseCatalog />
//   <ExternalCourseCatalog title="CURSOS DE PARTNERS" embedded />

interface Props {
    title?: string;
    embedded?: boolean; // sin padding de página
}

const formatDuration = (min: number | null) => {
    if (!min) return null;
    const h = Math.floor(min / 60);
    return h ? `${h} H` : `${min} MIN`;
};

const ExternalCourseCatalog = ({ title = "CURSOS DE PARTNERS", embedded = false }: Props) => {
    const { theme } = UseTheme();
    const [courses, setCourses] = useState<CatalogCourse[] | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        externalCoursesApi
            .catalog()
            .then(setCourses)
            .catch(() => setError(true));
    }, []);

    const rootClass = [
        "xc-root",
        "xc-catalog",
        theme === "light" && "xc-root--light",
        embedded && "xc-catalog--embedded",
    ]
        .filter(Boolean)
        .join(" ");

    if (error) return null;

    return (
        <section className={rootClass}>
            <h2 className="xc-catalog-title">{title}</h2>

            {!courses ? (
                <div className="xc-center xc-center--inline">
                    <Loader2 className="xc-spin" size={20} />
                </div>
            ) : !courses.length ? (
                <p className="xc-muted">Próximamente.</p>
            ) : (
                <div className="xc-grid">
                    {courses.map((c) => {
                        const branding = getPartnerBranding(c.partnerSlug);
                        const cover = getCourseCover(c.partnerSlug, c.courseSlug);
                        const logo = branding?.logo || c.partnerLogoUrl || null;
                        return (
                            <Link key={c.courseId} to={getCoursePath(c.partnerSlug, c.courseSlug)} className="xc-card">
                                <div className="xc-card-cover">
                                    {cover ? <img src={cover} alt="" /> : <span>{c.title}</span>}
                                </div>
                                <div className="xc-card-body">
                                    <div className="xc-partner">
                                        {logo && <img src={logo} alt="" />}
                                        <span>{(branding?.name || c.partnerName).toUpperCase()}</span>
                                    </div>
                                    <h3>{c.title}</h3>
                                    {c.description && <p>{c.description}</p>}
                                    <div className="xc-stats xc-stats--sm">
                                        <span>
                                            <Layers size={14} />
                                            {c.moduleCount} MÓDULOS
                                        </span>
                                        {formatDuration(c.estimatedDurationMinutes) && (
                                            <span>
                                                <Clock size={14} />
                                                {formatDuration(c.estimatedDurationMinutes)}
                                            </span>
                                        )}
                                    </div>
                                    <span className="xc-card-cta">
                                        VER CURSO
                                        <ChevronRight size={16} />
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default ExternalCourseCatalog;