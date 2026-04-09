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

  // --- LÓGICA MATRIX (Fondo) ---
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
      ctx.fillStyle = theme === "dark" ? "rgba(229, 229, 229, 0.1)" : "rgba(0, 0, 0, 0.69)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px 'JetBrains Mono'`;
      ctx.fillStyle = theme === "dark" ? "#ff5500" : "#ccff00";
      
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

  // --- ANIMACIÓN GSAP (Escala) ---
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(textRef.current, {
        scale: width > 768 ? 150 : 200,
        ease: "power2.in",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=1000",
          scrub: 1,
          pin: true,
        },
      });
    }, containerRef);
    return () => ctx.revert();
  }, [width]);

  return (
    <div className="mask-page">
      <div className={`container ${theme}`} ref={containerRef}>
        
        {/* EL CANVA ACTÚA COMO EL VIDEO (Z-INDEX 1) */}
        <div className="matrix-underlay">
          <canvas ref={canvasRef} />
        </div>

        {/* LA MÁSCARA (Z-INDEX 2) */}
        <div className="mask">
          <h2 className="home-title-mask" ref={textRef}>
            Hidden Security
          </h2>
        </div>

        {/* INFO FLOTANTE (Z-INDEX 10) */}
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