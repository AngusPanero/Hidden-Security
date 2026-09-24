import { useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import "./claimsManager.css"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface TargetUser {
    uid:   string
    email: string
}

interface ClaimsSnapshot {
    admin:                boolean
    isEnterprise:         boolean
    partner:              boolean
    companyName:          string | null
    companyLogo:          string | null
    purchases:            string[]
    purchaseExpiry:       Record<string, string>
    enterprisePlan:       string | null
    enterprisePlanExpiry: string | null
    vacancyLimit:         number | null
    vacanciesUsed:        number
    otherClaims:          string[]
}

type Action = "grant_user_plan" | "set_enterprise" | "make_partner" | "clear_purchases" | "clear_all"
type Tone   = "ok" | "warn" | "error" | "neutral"

interface Props {
    user:       TargetUser
    onClose:    () => void
    onUpdated?: () => void
}

// Solo para mostrar opciones. El backend valida todo por su cuenta.
const USER_PLAN_OPTIONS = [
    { id: "starter", label: "Starter", detail: "3 meses" },
    { id: "pro",     label: "Pro",     detail: "6 meses + 1 voucher" },
    { id: "elite",   label: "Elite",   detail: "12 meses + 2 vouchers" },
    { id: "voucher", label: "Voucher", detail: "Sin vencimiento, acumulable" },
]

const ENTERPRISE_PLAN_OPTIONS = [
    { id: "",           label: "Sin plan",   detail: "Solo cuenta Enterprise" },
    { id: "business",   label: "Business",   detail: "6 meses · 3 vacantes" },
    { id: "enterprise", label: "Enterprise", detail: "12 meses · vacantes ilimitadas" },
]

const ACTIONS: { id: Action; label: string; danger?: boolean }[] = [
    { id: "grant_user_plan", label: "Plan estudiante" },
    { id: "set_enterprise",  label: "Enterprise" },
    { id: "make_partner",    label: "Partner" },
    { id: "clear_purchases", label: "Limpiar compras", danger: true },
    { id: "clear_all",       label: "Reset total",     danger: true },
]

const MAX_LOGO_BYTES = 2 * 1024 * 1024

const uploadToCloudinary = async (file: File): Promise<string> => {
    const imgData = new FormData()
    imgData.append("file", file)
    imgData.append("upload_preset", "product-images")
    const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
        imgData
    )
    return response.data.secure_url
}

const formatDate = (iso?: string | null) => {
    if (!iso) return "—"
    const d = new Date(iso)
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const daysLeft = (iso?: string | null) => {
    if (!iso) return null
    const ms = new Date(iso).getTime() - Date.now()
    if (isNaN(ms)) return null
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

// Estado visual de un plan según su vencimiento
function planTone(expiry?: string | null): { tone: Tone; label: string; note: string } {
    const days = daysLeft(expiry)
    if (days === null) return { tone: "neutral", label: "SIN FECHA",  note: "No tiene vencimiento registrado" }
    if (days <= 0)     return { tone: "error",   label: "VENCIDO",    note: "Se limpia en el próximo refresh-claims" }
    if (days <= 7)     return { tone: "warn",    label: "POR VENCER", note: `Quedan ${days} día(s)` }
    return                    { tone: "ok",      label: "VIGENTE",    note: `Quedan ${days} días` }
}

// Filas del estado actual, con el formato del historial de compras
interface StateRow {
    id:      string
    title:   string
    left:    string
    tone:    Tone
    status:  string
    note:    string
    details: { label: string; value: string }[]
}

const ClaimsManager = ({ user, onClose, onUpdated }: Props) => {
    const API = import.meta.env.VITE_API_URL

    const [claims,      setClaims]      = useState<ClaimsSnapshot | null>(null)
    const [loadingData, setLoadingData] = useState(true)
    const [expandedId,  setExpandedId]  = useState<string | null>(null)
    const [action,      setAction]      = useState<Action>("grant_user_plan")

    const [userPlan,       setUserPlan]       = useState("starter")
    const [enterprisePlan, setEnterprisePlan] = useState("")
    const [companyName,    setCompanyName]    = useState("")
    const [logoFile,       setLogoFile]       = useState<File | null>(null)
    const [logoUrl,        setLogoUrl]        = useState("")
    const [confirmDanger,  setConfirmDanger]  = useState(false)

    const [pin,        setPin]        = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [feedback,   setFeedback]   = useState<{ ok: boolean; title: string; text?: string } | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // ── Cargar claims actuales ────────────────────────────────────────────────
    const loadClaims = async () => {
        setLoadingData(true)
        try {
            const { data } = await axios.get(`${API}/admin/claims/${user.uid}`, { withCredentials: true })
            setClaims(data.claims)
            if (data.claims.isEnterprise) {
                setCompanyName(data.claims.companyName || "")
                setLogoUrl(data.claims.companyLogo || "")
            }
        } catch (err: any) {
            setFeedback({ ok: false, title: err.response?.data?.message || "ERROR_LEYENDO_CLAIMS", text: "No se pudieron leer las claims del usuario." })
        } finally {
            setLoadingData(false)
        }
    }

    useEffect(() => {
        loadClaims()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.uid])

    // ── Cerrar con Escape ─────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !submitting) onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose, submitting])

    // ── Preview del logo (archivo o URL, nunca ambos) ─────────────────────────
    const logoPreview = useMemo(() => {
        if (logoFile) return URL.createObjectURL(logoFile)
        if (logoUrl.startsWith("https://")) return logoUrl
        return null
    }, [logoFile, logoUrl])

    useEffect(() => {
        return () => { if (logoFile && logoPreview) URL.revokeObjectURL(logoPreview) }
    }, [logoFile, logoPreview])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        if (!file) return
        if (!file.type.startsWith("image/")) {
            setFeedback({ ok: false, title: "ARCHIVO_INVÁLIDO", text: "El logo tiene que ser una imagen." })
            e.target.value = ""
            return
        }
        if (file.size > MAX_LOGO_BYTES) {
            setFeedback({ ok: false, title: "ARCHIVO_DEMASIADO_GRANDE", text: "El logo no puede superar los 2 MB." })
            e.target.value = ""
            return
        }
        setLogoUrl("")
        setLogoFile(file)
        setFeedback(null)
    }

    const clearLogo = () => {
        setLogoFile(null)
        setLogoUrl("")
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // ── Filas del estado actual ───────────────────────────────────────────────
    const stateRows = useMemo<StateRow[]>(() => {
        if (!claims) return []
        const rows: StateRow[] = []

        const plans = [...new Set(claims.purchases.filter(p => p !== "voucher"))]
        for (const planId of plans) {
            const expiry = claims.purchaseExpiry[planId]
            const t      = planTone(expiry)
            const isEnt  = planId === claims.enterprisePlan
            rows.push({
                id:     `plan-${planId}`,
                title:  planId.toUpperCase(),
                left:   `[${formatDate(expiry)}]`,
                tone:   t.tone,
                status: t.label,
                note:   t.note,
                details: [
                    { label: "Tipo",   value: isEnt ? "Plan Enterprise" : "Plan estudiante" },
                    { label: "Vence",  value: formatDate(expiry) },
                    ...(isEnt ? [
                        { label: "Vacantes", value: `${claims.vacanciesUsed} / ${claims.vacancyLimit === null ? "∞" : claims.vacancyLimit}` },
                    ] : []),
                ],
            })
        }

        const vouchers = claims.purchases.filter(p => p === "voucher").length
        if (vouchers > 0) {
            rows.push({
                id:     "vouchers",
                title:  `VOUCHER ×${vouchers}`,
                left:   "[SIN VENCIMIENTO]",
                tone:   "ok",
                status: "DISPONIBLE",
                note:   "Acumulables para rendir certificación",
                details: [{ label: "Cantidad", value: String(vouchers) }],
            })
        }

        if (claims.isEnterprise) {
            rows.push({
                id:     "enterprise",
                title:  claims.companyName || "EMPRESA SIN NOMBRE",
                left:   "[ENTERPRISE]",
                tone:   claims.enterprisePlan ? "ok" : "neutral",
                status: claims.enterprisePlan ? "CON PLAN" : "SIN PLAN",
                note:   "Cuenta de empresa",
                details: [
                    { label: "Empresa", value: claims.companyName || "—" },
                    { label: "Logo",    value: claims.companyLogo ? "Cargado" : "Sin logo" },
                    { label: "Plan",    value: claims.enterprisePlan?.toUpperCase() || "—" },
                ],
            })
        }

        if (claims.partner) {
            rows.push({
                id:     "partner",
                title:  "PARTNER",
                left:   "[ROL]",
                tone:   "ok",
                status: "ACTIVO",
                note:   "Acceso al dashboard de partners",
                details: [{ label: "Claim", value: "partner: true" }],
            })
        }

        if (claims.otherClaims.length > 0) {
            rows.push({
                id:     "other",
                title:  "OTRAS CLAIMS",
                left:   `[${claims.otherClaims.length}]`,
                tone:   "neutral",
                status: "INFO",
                note:   "Certificaciones y claims adicionales",
                details: claims.otherClaims.map(k => ({ label: k, value: "✓" })),
            })
        }

        return rows
    }, [claims])

    const roleLabel = claims?.admin ? "ADMIN" : claims?.isEnterprise ? "ENTERPRISE" : "USUARIO"

    // ── Validación local (solo UX, el backend decide) ─────────────────────────
    const isDanger = action === "clear_all" || action === "clear_purchases"

    const canSubmit =
        !submitting &&
        !loadingData &&
        /^\d{4}$/.test(pin) &&
        (!isDanger || confirmDanger) &&
        (action !== "set_enterprise" || companyName.trim().length >= 2) &&
        !claims?.admin

    const changeAction = (next: Action) => {
        setAction(next)
        setConfirmDanger(false)
        setFeedback(null)
    }

    // ── Enviar ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return

        setSubmitting(true)
        setFeedback(null)

        try {
            const body: Record<string, unknown> = { action, pin }

            if (action === "grant_user_plan") body.plan = userPlan

            if (action === "set_enterprise") {
                let finalLogo: string | null = logoUrl.trim() || null
                if (logoFile) finalLogo = await uploadToCloudinary(logoFile)
                body.companyName = companyName.trim()
                body.companyLogo = finalLogo
                body.plan        = enterprisePlan || null
            }

            const { data } = await axios.post(
                `${API}/admin/claims/${user.uid}`,
                body,
                { withCredentials: true }
            )

            setClaims(data.claims)
            setExpandedId(null)
            setFeedback({ ok: true, title: "CLAIMS_ACTUALIZADAS", text: "El cambio ya está aplicado en Firebase." })
            setConfirmDanger(false)
            if (logoFile) {
                setLogoFile(null)
                setLogoUrl(data.claims.companyLogo || "")
                if (fileInputRef.current) fileInputRef.current.value = ""
            }
            onUpdated?.()
        } catch (err: any) {
            setFeedback({
                ok:    false,
                title: err.response?.data?.message || "ERROR_APLICANDO_CAMBIO",
                text:  err.response?.data?.detail  || "No se pudo aplicar el cambio.",
            })
        } finally {
            setPin("")        // la clave nunca queda en memoria después del intento
            setSubmitting(false)
        }
    }

    return (
        <div className="cm-overlay" onClick={() => !submitting && onClose()}>
            <div
                className="cm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cm-title"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Hero ── */}
                <header className="cm-hero">
                    <div className="cm-hero-left">
                        <div className="cm-avatar">{user.email.charAt(0).toUpperCase()}</div>
                        <div className="cm-hero-text">
                            <h2 id="cm-title" className="cm-hero-name">Gestionar claims</h2>
                            <p className="cm-hero-email">{user.email}</p>
                        </div>
                    </div>
                    <div className="cm-hero-right">
                        {!loadingData && claims && <span className="cm-hero-badge">{roleLabel}</span>}
                        <button type="button" className="cm-close" onClick={onClose} disabled={submitting} aria-label="Cerrar">✕</button>
                    </div>
                </header>

                {/* ── Estado actual (formato historial) ── */}
                <section className="cm-section">
                    <span className="cm-section-title">Estado actual</span>

                    {loadingData ? (
                        <div className="cm-loading">
                            <span className="cm-loading-dot" /><span className="cm-loading-dot" /><span className="cm-loading-dot" />
                        </div>
                    ) : stateRows.length === 0 ? (
                        <div className="cm-empty-state">
                            <span className="cm-empty-icon">◫</span>
                            <p>SIN_CLAIMS_ASIGNADAS</p>
                        </div>
                    ) : (
                        <div className="cm-list">
                            {stateRows.map(row => {
                                const isExpanded = expandedId === row.id
                                return (
                                    <div key={row.id} className={`cm-list-wrapper cm-tone-${row.tone}`}>
                                        <button
                                            type="button"
                                            className="cm-row"
                                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                            aria-expanded={isExpanded}
                                        >
                                            <div className="cm-row-left">
                                                <span className="cm-row-date">{row.left}</span>
                                                <div className="cm-row-title-group">
                                                    <span className="cm-row-title">{row.title}</span>
                                                    <span className={`cm-row-note cm-row-note--${row.tone}`}>{row.note}</span>
                                                </div>
                                            </div>
                                            <div className="cm-row-right">
                                                <span className={`cm-status cm-status--${row.tone}`}>{row.status}</span>
                                                <span className="cm-chevron">{isExpanded ? "▲" : "▼"}</span>
                                            </div>
                                        </button>
                                        {isExpanded && (
                                            <div className="cm-row-detail">
                                                {row.details.map(d => (
                                                    <div key={d.label} className="cm-detail-row">
                                                        <span>{d.label}</span>
                                                        <strong>{d.value}</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>

                {claims?.admin ? (
                    <div className="cm-section">
                        <div className="cm-message cm-message--error">
                            <strong>CUENTA_PROTEGIDA</strong>
                            <span>Las cuentas admin no se pueden modificar desde el panel.</span>
                        </div>
                    </div>
                ) : (
                    <form className="cm-form" onSubmit={handleSubmit}>

                        {/* ── Tabs de acción ── */}
                        <div className="cm-tabs" role="tablist">
                            {ACTIONS.map(a => (
                                <button
                                    key={a.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={action === a.id}
                                    className={`cm-tab${action === a.id ? " active" : ""}${a.danger ? " danger" : ""}`}
                                    onClick={() => changeAction(a.id)}
                                    disabled={submitting}
                                >
                                    {a.label}
                                </button>
                            ))}
                        </div>

                        {/* ── 1) Plan estudiante ── */}
                        {action === "grant_user_plan" && (
                            <div className="cm-block">
                                <span className="cm-detail-title">Asignar plan de estudiante</span>
                                {claims?.isEnterprise && (
                                    <div className="cm-message cm-message--warn">
                                        <strong>CUENTA_ENTERPRISE</strong>
                                        <span>El servidor va a rechazar planes de estudiante para esta cuenta.</span>
                                    </div>
                                )}
                                <div className="cm-list" role="radiogroup">
                                    {USER_PLAN_OPTIONS.map(p => (
                                        <label key={p.id} className={`cm-option${userPlan === p.id ? " active" : ""}`}>
                                            <input
                                                type="radio"
                                                name="userPlan"
                                                value={p.id}
                                                checked={userPlan === p.id}
                                                onChange={() => setUserPlan(p.id)}
                                            />
                                            <span className="cm-option-label">{p.label}</span>
                                            <span className="cm-option-detail">{p.detail}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── 2) Enterprise ── */}
                        {action === "set_enterprise" && (
                            <div className="cm-block">
                                <span className="cm-detail-title">Cuenta Enterprise</span>

                                <label className="cm-field">
                                    <span>Nombre de la empresa</span>
                                    <input
                                        type="text"
                                        value={companyName}
                                        maxLength={80}
                                        onChange={e => setCompanyName(e.target.value)}
                                        placeholder="Ej: Acme Security"
                                    />
                                </label>

                                <div className="cm-field">
                                    <span>Logo — subí un archivo o pegá una URL</span>
                                    <div className="cm-logo-grid">
                                        <label className={`cm-upload${logoUrl ? " disabled" : ""}`}>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                disabled={!!logoUrl || submitting}
                                            />
                                            {logoFile ? logoFile.name : "Subir imagen"}
                                        </label>
                                        <span className="cm-or">o</span>
                                        <input
                                            type="url"
                                            className="cm-url"
                                            value={logoUrl}
                                            maxLength={300}
                                            placeholder="https://..."
                                            onChange={e => setLogoUrl(e.target.value)}
                                            disabled={!!logoFile || submitting}
                                        />
                                    </div>
                                    {(logoPreview || logoFile || logoUrl) && (
                                        <div className="cm-logo-preview">
                                            {logoPreview
                                                ? <img src={logoPreview} alt="Vista previa del logo" />
                                                : <span className="cm-logo-placeholder">{companyName.charAt(0).toUpperCase() || "?"}</span>}
                                            <button type="button" className="cm-link" onClick={clearLogo} disabled={submitting}>
                                                Quitar logo
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <span className="cm-field-label">Plan</span>
                                <div className="cm-list" role="radiogroup">
                                    {ENTERPRISE_PLAN_OPTIONS.map(p => (
                                        <label key={p.id || "none"} className={`cm-option${enterprisePlan === p.id ? " active" : ""}`}>
                                            <input
                                                type="radio"
                                                name="enterprisePlan"
                                                value={p.id}
                                                checked={enterprisePlan === p.id}
                                                onChange={() => setEnterprisePlan(p.id)}
                                            />
                                            <span className="cm-option-label">{p.label}</span>
                                            <span className="cm-option-detail">{p.detail}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── 3) Partner ── */}
                        {action === "make_partner" && (
                            <div className="cm-block">
                                <span className="cm-detail-title">Rol partner</span>
                                <div className={`cm-message ${claims?.partner ? "cm-message--ok" : "cm-message--neutral"}`}>
                                    <strong>{claims?.partner ? "YA_ES_PARTNER" : "AGREGAR_PARTNER"}</strong>
                                    <span>
                                        {claims?.partner
                                            ? "Este usuario ya tiene partner: true."
                                            : "Agrega partner: true sin tocar el resto de sus claims."}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* ── 4 / 5) Destructivas ── */}
                        {isDanger && (
                            <div className="cm-block">
                                <span className="cm-detail-title cm-detail-title--danger">
                                    {action === "clear_all" ? "Reset total" : "Limpiar compras"}
                                </span>
                                <div className="cm-message cm-message--error">
                                    <strong>ACCIÓN_IRREVERSIBLE</strong>
                                    <span>
                                        {action === "clear_all"
                                            ? "Borra todas las claims (compras, enterprise, partner, certificaciones) y cierra las sesiones del usuario."
                                            : "Borra planes, vouchers, vencimientos y datos del plan enterprise. Conserva tipo de cuenta, empresa, partner y certificaciones."}
                                    </span>
                                </div>
                                <label className="cm-check">
                                    <input
                                        type="checkbox"
                                        checked={confirmDanger}
                                        onChange={e => setConfirmDanger(e.target.checked)}
                                    />
                                    Confirmo que quiero aplicar esto a {user.email}
                                </label>
                            </div>
                        )}

                        {/* ── Firma ── */}
                        <div className="cm-sign">
                            <label className="cm-field cm-pin-field">
                                <span>Clave de firma</span>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={4}
                                    value={pin}
                                    onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="••••"
                                    disabled={submitting}
                                />
                            </label>
                            <button
                                type="submit"
                                className={`cm-submit${isDanger ? " danger" : ""}`}
                                disabled={!canSubmit}
                            >
                                {submitting ? "Aplicando…" : "Firmar y aplicar"}
                            </button>
                        </div>

                        {feedback && (
                            <div className={`cm-message ${feedback.ok ? "cm-message--ok" : "cm-message--error"}`} role="status">
                                <strong>{feedback.title}</strong>
                                {feedback.text && <span>{feedback.text}</span>}
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    )
}

export default ClaimsManager