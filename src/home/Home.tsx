import { useRef, useLayoutEffect, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./home.css"; 
import { UseWidth } from "../contexts/WidthContext";
import { UseTheme } from "../contexts/ThemeContext";

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const { width } = UseWidth();
  const { theme } = UseTheme();
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const canvasRef = useRef(null);
  const welcomeTextRef = useRef(null); // Ref para el nuevo texto interno

  // --- LÓGICA MATRIX (Tus colores y opacidades originales) ---
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

  // --- ANIMACIÓN GSAP (Escala + Revelado al final) ---
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

      // 1. Escala de la máscara
      tl.to(textRef.current, {
        scale: width > 768 ? 100 : 200,
        ease: "power2.in",
        
      }, 0);

      // 2. Revelado del texto central (Inicia al 70% del scroll)
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
        0.3 // Punto de inserción en el timeline (de 0 a 1)
      );

    }, containerRef);
    return () => ctx.revert();
  }, [width]);

  return (
    <div className="mask-page">
      <div className={`container ${theme}`} ref={containerRef}>
        
        <div className="matrix-underlay">
          <canvas ref={canvasRef} />
          
          {/* TÍTULO QUE SE REVELA AL FINAL */}
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
  );
};

export default Home;