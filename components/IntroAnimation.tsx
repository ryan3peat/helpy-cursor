import React, { useEffect, useState } from 'react';

interface IntroAnimationProps {
  onComplete: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Start exit after 2 seconds
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 500); // Allow fade out time
    }, 2000);

    return () => clearTimeout(exitTimer);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#3EAFD2' }}
    >
      <h1 
        className="text-white text-6xl animate-breathe"
        style={{ fontFamily: "'Peanut Butter', 'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        helpy
      </h1>
    </div>
  );
};

export default IntroAnimation;
