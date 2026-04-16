import { useEffect, useState, useRef } from "react";

const LiveTypingText = ({ text, className }: { text: string; className?: string }) => {
  const [displayed, setDisplayed] = useState("");
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef<HTMLSpanElement>(null);

  // 1. Observador para detectar el scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          // Una vez que lo vemos, dejamos de observar para que no se repita
          if (elementRef.current) observer.unobserve(elementRef.current);
        }
      },
      { 
        threshold: 0.2 // Se activa cuando el 20% del texto es visible
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 2. Lógica de tipeo (solo corre cuando isIntersecting es true)
  useEffect(() => {
    if (!text || !isIntersecting) return;
    
    let i = 0;
    setDisplayed("");
    
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 15);

    return () => clearInterval(interval);
  }, [text, isIntersecting]);

  return (
    <span ref={elementRef} className={className}>
      {displayed}
      {/* Opcional: Cursor visual para mejorar la estética */}
      <span style={{ opacity: displayed.length === text.length ? 0 : 1 }}>|</span>
    </span>
  );
};

export default LiveTypingText;