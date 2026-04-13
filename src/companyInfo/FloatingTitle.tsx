import { motion } from "framer-motion";

const FloatingTitle = ({ text }: { text: string }) => {
  const letters = Array.from(text);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04, // Un poco más rápido para impacto inicial
        delayChildren: 0.2,    // Pequeño respiro para que el layout cargue
      },
    },
  };

  const letterVariants = {
    hidden: () => ({
      opacity: 0,
      // Reducimos un poco el rango para que en móvil no viajen desde tan lejos
      x: Math.random() * 1000 - 500, 
      y: Math.random() * 1000 - 500,
      z: Math.random() * -2000 - 500, 
      scale: 0.2,
      rotateX: Math.random() * 360 - 180,
      rotateY: Math.random() * 360 - 180,
      rotateZ: Math.random() * 360 - 180,
      filter: "blur(20px) brightness(0)",
    }),
    visible: {
      opacity: 1,
      x: 0, y: 0, z: 0,
      scale: 1,
      rotateX: 0, rotateY: 0, rotateZ: 0,
      filter: "blur(0px) brightness(1)",
      transition: {
        duration: 2.2, // Un toque más ágil para la carga inicial
        ease: [0.16, 1, 0.3, 1], // Easeout ultra fluido
      },
    },
  };

  return (
    <motion.h1
      className="k-massive-title"
      variants={containerVariants}
      initial="hidden"
      animate="visible" // <--- CAMBIO VITAL: Dispara apenas carga
      style={{ 
        display: "flex", 
        flexWrap: "wrap", 
        justifyContent: "center",
        perspective: "1200px", 
        transformStyle: "preserve-3d",
        zIndex: 10,
        position: "relative"
      }}
    >
      {letters.map((char, i) => (
        <motion.span
          key={i}
          variants={letterVariants}
          style={{ 
            display: "inline-block", 
            whiteSpace: char === " " ? "pre" : "normal",
            willChange: "transform, opacity, filter",
            transformOrigin: "center center -200px"
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.h1>
  );
};

export default FloatingTitle;