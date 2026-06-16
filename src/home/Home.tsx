import { useRef, useLayoutEffect, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./home.css";
import { UseWidth } from "../contexts/WidthContext";
import { UseTheme } from "../contexts/ThemeContext";
import FloatingCardSection from "../floatingCard/FloatingCard";
import LogoCarrousel from "../logoCarrousel/LogoCarrousel";
import Mission from "../mision/Mission";

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const { width }  = UseWidth();
  const { theme }  = UseTheme();

  const containerRef      = useRef<HTMLDivElement>(null);
  const textRef           = useRef<HTMLHeadingElement>(null);
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const welcomeTextRef    = useRef<HTMLDivElement>(null);
  const floatingInfoRef   = useRef<HTMLDivElement>(null);
  const scanlineRef       = useRef<HTMLDivElement>(null);
  const glitchLayerRef    = useRef<HTMLDivElement>(null);

  // ── Matrix canvas ──────────────────────────────────────────────
  useEffect(() => {
    const canvas  = canvasRef.current;
    if (!canvas) return;
    const ctx     = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const characters = "01010101HIDDENSECURITYアァカサタナハマヤラ";
    const charArray  = characters.split("");
    const fontSize   = 14;
    const columns    = Math.floor(canvas.width / fontSize);
    const drops      = Array(columns).fill(1);

    const draw = () => {
      // trail más largo en dark, más corto en light
      ctx.fillStyle = theme === "dark"
        ? "rgba(0, 0, 0, 0.06)"
        : "rgba(245, 245, 245, 0.10)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font      = `${fontSize}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = theme === "dark" ? "#ccff00" : "#ff5500";

      for (let i = 0; i < drops.length; i++) {
        // cabeza de columna más brillante
        const isHead = drops[i] * fontSize > 0 && drops[i] * fontSize < canvas.height;
        if (isHead) {
          ctx.fillStyle = theme === "dark" ? "#ffffff" : "#000000";
        } else {
          ctx.fillStyle = theme === "dark"
            ? `rgba(204, 255, 0, ${Math.random() * 0.5 + 0.3})`
            : `rgba(255, 85, 0, ${Math.random() * 0.5 + 0.3})`;
        }

        const text = charArray[Math.floor(Math.random() * charArray.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 40);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, [theme]);

  // ── GSAP scroll en 3 fases ─────────────────────────────────────
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {

      const isMobile = width <= 768;

      // Estado inicial: info flotante invisible
      gsap.set(floatingInfoRef.current, { autoAlpha: 0, y: 20 });
      gsap.set(welcomeTextRef.current,  { autoAlpha: 0, y: 30, /* filter: "blur(12px)" */ });
      gsap.set(scanlineRef.current,     { autoAlpha: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger:    containerRef.current,
          start:      "top top",
          end:        isMobile ? "+=1200" : "+=1800",
          scrub:      1,
          pin:        true,
          anticipatePin: 1,
        },
      });

      // ── FASE 1 (0→0.45): info flotante aparece + mask escala ──
      tl.to(floatingInfoRef.current, {
        autoAlpha: 1,
        y:         0,
        duration:  0.15,
        ease:      "power2.out",
      }, 0);

      tl.to(textRef.current, {
        scale:    isMobile ? 180 : 90,
        ease:     "power3.in",
        duration: 0.45,
      }, 0);

      // ── FASE 2 (0.45→0.65): glitch + fade out de la mask layer ──
      tl.to(glitchLayerRef.current, {
        autoAlpha: 0.6,
        duration:  0.08,
        ease:      "none",
        yoyo:      true,
        repeat:    3,
      }, 0.42);

      tl.to(textRef.current, {
        autoAlpha: 0,
        duration:  0.12,
        ease:      "power1.in",
      }, 0.5);

      // scanline aparece brevemente
      tl.to(scanlineRef.current, {
        autoAlpha: 1,
        duration:  0.05,
      }, 0.5)
      .to(scanlineRef.current, {
        autoAlpha: 0,
        duration:  0.10,
      }, 0.58);

      // ── FASE 3 (0.65→1): texto central se revela ──
      tl.to(welcomeTextRef.current, {
        autoAlpha: 1,
        y:         0,
        /* filter:    "blur(0px)", */
        duration:  0.35,
        ease:      "power2.out",
        zIndex:    10,
      }, 0.65);

      // Sacar el blend mode de la máscara para que no interfiera con el texto
      tl.set(textRef.current?.parentElement ?? {}, {
        mixBlendMode: "normal",
        background:   "transparent",
      }, 0.52);

      // eyebrow line dibujándose
      tl.fromTo(".matrix-welcome-line", {
        scaleX: 0,
      }, {
        scaleX:   1,
        duration: 0.25,
        ease:     "power2.out",
      }, 0.70);

      // info flotante fade out cuando aparece el texto central
      tl.to(floatingInfoRef.current, {
        autoAlpha: 0,
        y:         -10,
        duration:  0.15,
        ease:      "power1.in",
      }, 0.68);
    }, containerRef);

    return () => ctx.revert();
  }, [width]);

  return (
    <>
      <div className="mask-page">
        <div className={`container ${theme}`} ref={containerRef}>

          {/* ── Fondo: canvas matrix ── */}
          <div className="matrix-underlay">
            <canvas ref={canvasRef} />

            {/* Scanline flash al romper la máscara */}
            <div ref={scanlineRef} className="mask-scanline" />

            {/* Glitch overlay */}
            <div ref={glitchLayerRef} className="mask-glitch-layer" />

            {/* Texto central — FASE 3 */}
            <div className="matrix-content-overlay">
              <div ref={welcomeTextRef} className="matrix-welcome-inner">
                <span className="matrix-welcome-eyebrow">
                  // HIDDEN_SECURITY
                </span>
                <div className="matrix-welcome-line" />
                <h2 className="matrix-welcome-title">
                  ¿PREPARADO PARA DOMINAR<br />LA CIBERSEGURIDAD?
                </h2>
                <p className="matrix-welcome-sub">
                  Formación técnica avanzada · Red de talento · Bolsa de trabajo
                </p>
              </div>
            </div>
          </div>

          {/* ── Máscara de texto ── */}
          <div className="mask">
            <h2 className="home-title-mask" ref={textRef}>
              Hidden Security
            </h2>
          </div>

          {/* ── Info flotante — FASE 1 ── */}
          <div className="hero-floating-info" ref={floatingInfoRef}>
            <div className="info-badge">EST. 2026</div>
            <p className="info-desc">Defensa Digital Avanzada.</p>
            <div className="scroll-indicator">
              <span>SCROLL PARA REVELAR</span>
              <div className="line" />
            </div>
          </div>

          {/* Vignette esquinas */}
          <div className="mask-vignette" />
        </div>
      </div>

      <Mission />
      <FloatingCardSection />
      <LogoCarrousel />
    </>
  );
};

export default Home;

/* ANTERIOR */ 
/* import { useRef, useLayoutEffect, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./home.css"; 
import { UseWidth } from "../contexts/WidthContext";
import { UseTheme } from "../contexts/ThemeContext";
import FloatingCardSection from "../floatingCard/FloatingCard";
import LogoCarrousel from "../logoCarrousel/LogoCarrousel";
import Mission from "../mision/Mission";

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const { width } = UseWidth();
  const { theme } = UseTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const welcomeTextRef = useRef<HTMLHeadingElement>(null); 

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    const characters = "01010101HIDDENSECURITYアァカサタナ";
    const charArray = characters.split("");
    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = theme === "dark" ? "rgba(13, 13, 13, 0.41)" : "rgba(223, 223, 223, 0.69)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px 'JetBrains Mono'`;
      ctx.fillStyle = theme === "dark" ? "#ccff00" : "#ff5500";
      
      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", setCanvasSize);
    };
  }, [theme]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=1000",
          scrub: 1,
          pin: true,
        },
      });

      tl.to(textRef.current, {
        scale: width > 768 ? 100 : 200,
        ease: "power2.in",
        
      }, 0);

      tl.fromTo(welcomeTextRef.current, 
        { 
          opacity: 0, 
          scale: 0.8,
          filter: "blur(10px)" 
        }, 
        { 
          opacity: 1, 
          scale: 1, 
          filter: "blur(0px)",
          ease: "power2.out"
        }, 
        0.3 
      );

    }, containerRef);
    return () => ctx.revert();
  }, [width]);

  return (
    <>
    <div className="mask-page">
      <div className={`container ${theme}`} ref={containerRef}>
        
        <div className="matrix-underlay">
          <canvas ref={canvasRef} />
          
          <div className="matrix-content-overlay">
            <h2 ref={welcomeTextRef} className="matrix-welcome-title">
              ¿PREPARADO PARA DOMINAR <br /> LA CIBERSEGURIDAD?
            </h2>
          </div>
        </div>

        <div className="mask">
          <h2 className="home-title-mask" ref={textRef}>
            Hidden Security
          </h2>
        </div>

        <div className="hero-floating-info">
          <div className="info-badge">EST. 2026</div>
          <p className="info-desc">Defensa Digital Avanzada.</p>
          <div className="scroll-indicator">
            <span>SCROLL PARA REVELAR</span>
            <div className="line"></div>
          </div>
        </div>
      </div>
    </div>
    <Mission />
    <FloatingCardSection />
    <LogoCarrousel />
    </>
  );
};

export default Home; */