"use client";

import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import {
  Home, ClipboardList, Utensils, DollarSign, BookOpen, Users, Baby, Heart,
  HeartHandshake, Coffee, Sun, Moon, Cookie, Calendar, ShoppingCart, MapPin,
  Phone, GraduationCap, Stethoscope, Shirt, Sparkles, Car, Receipt, Languages, Pin,
} from "lucide-react";

const icons = [
  Home, ClipboardList, Utensils, DollarSign, BookOpen, Users, Baby, Heart,
  HeartHandshake, Coffee, Sun, Moon, Cookie, Calendar, ShoppingCart, MapPin,
  Phone, GraduationCap, Stethoscope, Shirt, Sparkles, Car, Receipt, Languages, Pin,
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default function IntroPage() {
  const [fallenCount, setFallenCount] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const [isBurping, setIsBurping] = useState(false);
  const [burpsDone, setBurpsDone] = useState<number[]>([]);

  const baseScale = 0.5;
  const maxScale = 1.0;
  const currentScale = baseScale + (fallenCount / icons.length) * (maxScale - baseScale);

  // Two gentle burps: at 8th and 16th icon
  const burpAt = [8, 16];
  if (burpAt.includes(fallenCount) && !burpsDone.includes(fallenCount) && !isBurping) {
    setIsBurping(true);
    setBurpsDone((prev) => [...prev, fallenCount]);
    setTimeout(() => setIsBurping(false), 350);
  }

  const handleIconLanded = () => {
    setFallenCount((c) => c + 1);
  };

  const resetAnimation = () => {
    setFallenCount(0);
    setIsBurping(false);
    setBurpsDone([]);
    setAnimationKey((prev) => prev + 1);
  };

  const iconConfigs = useMemo(() => {
    return icons.map((Icon, i) => ({
      Icon,
      startX: 15 + seededRandom(i + animationKey * 100) * 70,
      delay: i * 0.075, // 25 icons over 1.8s
    }));
  }, [animationKey]);

  return (
    <div className="min-h-screen bg-[#3EAFD2] flex flex-col items-center justify-center relative overflow-hidden">
      <button
        onClick={resetAnimation}
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-white text-sm font-medium"
      >
        Replay
      </button>

      {/* Falling Icons */}
      {iconConfigs.map((config, index) => (
        <FallingIcon
          key={`${animationKey}-${index}`}
          Icon={config.Icon}
          startX={config.startX}
          delay={config.delay}
          onLanded={handleIconLanded}
        />
      ))}

      {/* Helpy Logo */}
      <motion.div
        className="text-6xl sm:text-7xl lg:text-8xl select-none z-10"
        animate={{ 
          scale: isBurping 
            ? currentScale * 1.06 // gentle burp
            : currentScale, // smooth growth
        }}
        style={{ 
          fontFamily: '"Peanut Butter", cursive',
          color: '#ffffff',
        }}
        transition={{ 
          scale: { 
            type: "spring", 
            stiffness: 300, 
            damping: 15,
          },
        }}
      >
        helpy
      </motion.div>

      <div className="absolute bottom-8 text-white/60 text-sm">
        {fallenCount} / {icons.length}
      </div>
    </div>
  );
}

interface FallingIconProps {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  startX: number;
  delay: number;
  onLanded: () => void;
}

function FallingIcon({ Icon, startX, delay, onLanded }: FallingIconProps) {
  // Calculate diagonal path - icons converge toward center (50%) as they fall
  const distanceFromCenter = startX - 50; // negative if left of center, positive if right
  
  return (
    <motion.div
      className="absolute text-white z-30"
      style={{ left: `${startX}%`, top: "-120px" }}
      animate={{
        // Start way above screen, fall to center
        y: ["0px", "calc(50vh + 120px)"],
        // Move horizontally toward center as falling (diagonal path)
        x: [`0vw`, `${-distanceFromCenter}vw`],
        opacity: [1, 1, 1, 0],
        scale: [1, 1, 0.5, 0],
      }}
      transition={{
        duration: 1.2,
        delay: delay,
        ease: [0.4, 0, 0.9, 1], // accelerate as falling
        times: [0, 0.65, 0.9, 1],
      }}
      onAnimationComplete={onLanded}
    >
      <Icon size={28} strokeWidth={1.5} />
    </motion.div>
  );
}
