import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Home, ClipboardList, Utensils, DollarSign, BookOpen, Users, Baby, Heart,
  HeartHandshake, Coffee, Sun, Moon, Cookie, Calendar, ShoppingCart, MapPin,
  Phone, GraduationCap, Stethoscope, Shirt, Sparkles, Car, Receipt, Languages, Pin,
} from 'lucide-react';

const icons = [
  Home, ClipboardList, Utensils, DollarSign, BookOpen, Users, Baby, Heart,
  HeartHandshake, Coffee, Sun, Moon, Cookie, Calendar, ShoppingCart, MapPin,
  Phone, GraduationCap, Stethoscope, Shirt, Sparkles, Car, Receipt, Languages, Pin,
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

interface IntroAnimationProps {
  onComplete: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [fallenCount, setFallenCount] = useState(0);
  const [isBurping, setIsBurping] = useState(false);
  const [burpsDone, setBurpsDone] = useState<number[]>([]);
  const [isExiting, setIsExiting] = useState(false);

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

  // When all icons have fallen, start exit animation
  useEffect(() => {
    if (fallenCount >= icons.length && !isExiting) {
      // Small delay to show the full logo
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 500); // Allow fade out time
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [fallenCount, isExiting, onComplete]);

  const iconConfigs = useMemo(() => {
    return icons.map((Icon, i) => ({
      Icon,
      startX: 15 + seededRandom(i) * 70,
      delay: i * 0.075, // 25 icons over ~1.8s
    }));
  }, []);

  return (
    <motion.div 
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#3EAFD2' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Falling Icons */}
      {iconConfigs.map((config, index) => (
        <FallingIcon
          key={index}
          Icon={config.Icon}
          startX={config.startX}
          delay={config.delay}
          onLanded={handleIconLanded}
        />
      ))}

      {/* Helpy Logo */}
      <motion.div
        className="text-6xl sm:text-7xl lg:text-8xl select-none z-10"
        initial={{ scale: 0.5 }}
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
    </motion.div>
  );
};

interface FallingIconProps {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  startX: number;
  delay: number;
  onLanded: () => void;
}

function FallingIcon({ Icon, startX, delay, onLanded }: FallingIconProps) {
  const distanceFromCenter = startX - 50;
  
  return (
    <motion.div
      className="absolute text-white z-30"
      style={{ left: `${startX}%`, top: "-120px" }}
      animate={{
        y: ["0px", "calc(50vh + 120px)"],
        x: [`0vw`, `${-distanceFromCenter}vw`],
        opacity: [1, 1, 1, 0],
        scale: [1, 1, 0.5, 0],
      }}
      transition={{
        duration: 1.2,
        delay: delay,
        ease: [0.4, 0, 0.9, 1],
        times: [0, 0.65, 0.9, 1],
      }}
      onAnimationComplete={onLanded}
    >
      <Icon size={28} strokeWidth={1.5} />
    </motion.div>
  );
}

export default IntroAnimation;
