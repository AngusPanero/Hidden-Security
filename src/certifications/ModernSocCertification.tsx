import CertificationExam from "./CertificationExam";

// Wrapper de UNA sola certificación — todo lo genérico (reglas, permisos,
// timer, fullscreen, confetti) vive en CertificationExam.tsx. Para agregar
// una nueva certificación en el futuro, se crea otro archivo idéntico a
// este, cambiando solo certId/title.
export default function ModernSocCertification() {
  return (
    <CertificationExam
      certId="modernsoc-cert"
      title="Modern SOC Operations"
    />
  );
}