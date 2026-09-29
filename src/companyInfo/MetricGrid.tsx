import React, { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate, useInView } from "framer-motion";

interface MetricItem {
  id: string;
  value?: string | number; // Puede ser un número o una cadena que represente un número
  label: string;
  suffix?: string;
}

interface MetricGridProps {
  items?: MetricItem[];
  columns?: number;
  accentColor?: string;
}

// Devuelve el número si es válido, o null (cubre undefined, "", "abc", NaN, Infinity)
const toSafeNumber = (value: MetricItem["value"]): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

// --- SUB-COMPONENTE CON DISPARO POR VISIBILIDAD ---
const Counter = ({ value, isInView }: { value: number; isInView: boolean }) => {
  const count = useMotionValue(0);
  const hasDecimals = !Number.isInteger(value);

  const rounded = useTransform(count, (latest) => {
    return hasDecimals ? latest.toFixed(1) : Math.round(latest).toString();
  });

  useEffect(() => {
    // Solo iniciamos la animación si el padre está "InView"
    if (isInView) {
      const controls = animate(count, value, {
        duration: 2.5,
        ease: [0.16, 1, 0.3, 1],
      });
      return controls.stop;
    }
  }, [value, count, isInView]);

  return <motion.span>{rounded}</motion.span>;
};

export const MetricGrid: React.FC<MetricGridProps> = ({
  items = [],
  columns = 3,
  accentColor = "var(--k-accent)"
}) => {
  // Referencia al contenedor principal para detectar el scroll
  const containerRef = useRef<HTMLElement>(null);

  // Detecta si la sección está en pantalla (amount: 0.3 significa que espera a que se vea el 30%)
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });

  return (
    <section className="k-metrics-reusable" ref={containerRef}>
      <div
        className="k-metrics-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {items.map((item, i) => {
          const numericValue = toSafeNumber(item.value);
          const hasValue = numericValue !== null;

          return (
            <motion.div
              key={item.id}
              className="k-metric-card"
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
            >
              <div className="k-metric-border" style={{ backgroundColor: accentColor }} />

              <div className="k-metric-content">
                <span className="k-metric-id">ID_{item.id}</span>

                {(hasValue || item.suffix) && (
                  <h3 className="k-metric-value">
                    {/* Solo montamos el contador si hay un valor numérico válido */}
                    {hasValue && <Counter value={numericValue} isInView={isInView} />}
                    {item.suffix && (
                      <span className="k-metric-suffix" style={{ color: accentColor }}>
                        {item.suffix}
                      </span>
                    )}
                  </h3>
                )}

                <div className="k-metric-info">
                  <div className="k-metric-dot" style={{ backgroundColor: accentColor }} />
                  <p className="k-metric-label">{item.label}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};