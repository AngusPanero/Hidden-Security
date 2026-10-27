// ─────────────────────────────────────────────────────────────────────
// Registro de branding de partners (solo visual).
// Lee automáticamente:
//   externalCourses/<empresa>/partner.ts
//   externalCourses/<empresa>/<curso>/cover.(webp|jpg|png)
// Una empresa nueva aparece sola: no hay que tocar este archivo.
// La estructura y el orden del curso NO viven acá: vienen del backend.
// ─────────────────────────────────────────────────────────────────────

export interface PartnerBranding {
    slug: string;
    name: string;
    logo?: string;   // URL importada (import logo from "./logo.webp")
    accent?: string; // color opcional para detalles del partner
}

const partnerModules = import.meta.glob<{ default: PartnerBranding }>("../*/partner.ts", {
    eager: true,
});

const coverModules = import.meta.glob<string>("../*/*/cover.{webp,jpg,jpeg,png}", {
    eager: true,
    query: "?url",
    import: "default",
});

const norm = (s: string) => s.toLowerCase();

const partners = new Map<string, PartnerBranding>();
for (const [file, mod] of Object.entries(partnerModules)) {
    const folder = file.split("/")[1];
    if (mod.default) partners.set(norm(folder), mod.default);
}

const covers = new Map<string, string>();
for (const [file, url] of Object.entries(coverModules)) {
    const [, partner, course] = file.split("/");
    covers.set(`${norm(partner)}/${norm(course)}`, url);
}

export function getPartnerBranding(partnerSlug?: string): PartnerBranding | null {
    if (!partnerSlug) return null;
    return partners.get(norm(partnerSlug)) ?? null;
}

export function getCourseCover(partnerSlug?: string, courseSlug?: string): string | null {
    if (!partnerSlug || !courseSlug) return null;
    return covers.get(`${norm(partnerSlug)}/${norm(courseSlug)}`) ?? null;
}

export function getCoursePath(partnerSlug: string, courseSlug: string): string {
    return `/cursos/${partnerSlug}/${courseSlug}`;
}